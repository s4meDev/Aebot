"""Localizo só a biblioteca autorizada; não leio tokens nem navego no SharePoint."""
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from .updates import UpdateError, json_object, no_links

COMPANY_FOLDER_URL = 'https://aegeactl.sharepoint.com/sites/analisequalidade/Shared%20Documents/Funcionalidades/AEBOT'


def updater_storage() -> Path:
    return Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'AEBOT/Updater'


def default_install_directory() -> Path:
    return updater_storage().parent / 'Application'


def registry_locations() -> list[tuple[str, str]]:
    """Uso os pontos de montagem publicados pelo OneDrive, sem credenciais."""
    try:
        import winreg
    except ImportError:
        return []
    locations = []
    for branch, folder_key, url_key in [
        (r'Software\SyncEngines\Providers\OneDrive', 'MountPoint', 'UrlNamespace'),
        (r'Software\Microsoft\OneDrive\Accounts', 'UserFolder', 'ServiceEndpointUri'),
    ]:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, branch) as parent:
                for index in range(winreg.QueryInfoKey(parent)[0]):
                    try:
                        name = winreg.EnumKey(parent, index)
                        if folder_key == 'UserFolder' and not name.casefold().startswith('business'):
                            continue
                        with winreg.OpenKey(parent, name) as key:
                            folder = winreg.QueryValueEx(key, folder_key)[0]
                            try:
                                url = winreg.QueryValueEx(key, url_key)[0]
                            except OSError:
                                url = ''
                            if isinstance(folder, str) and isinstance(url, str):
                                locations.append((folder, '' if folder_key == 'UserFolder' else url))
                    except OSError:
                        continue
        except OSError:
            continue
    return locations


def discover_sources(locations=None) -> list[str]:
    target = urlparse(COMPANY_FOLDER_URL)
    desired = unquote(target.path).rstrip('/')
    candidates = []
    for folder, url in registry_locations() if locations is None else locations:
        if not folder:
            continue
        namespace = urlparse(url)
        prefix = unquote(namespace.path).rstrip('/')
        if namespace.hostname == target.hostname and prefix and (desired.casefold() == prefix.casefold() or desired.casefold().startswith(prefix.casefold() + '/')):
            remainder = desired[len(prefix):].strip('/')
            candidates.append(str(Path(folder).joinpath(*remainder.split('/'))) if remainder else folder)
        # Atalhos do OneDrive podem montar só AEBOT ou a pasta Funcionalidades.
        if namespace.hostname == target.hostname or not url:
            candidates.extend(str(Path(folder) / tail) for tail in ('AEBOT', 'Funcionalidades/AEBOT'))
    return list(dict.fromkeys(candidates))[:24]


def source_candidates(storage: Path) -> list[str]:
    config = storage / 'source.json'
    no_links(config)
    if config.exists():
        if config.stat().st_size > 16000:
            raise UpdateError('Configuração de origem inválida.')
        data = json_object(config.read_bytes())
        if set(data) != {'schema', 'directory'} or type(data['schema']) is not int or data['schema'] != 1 or not isinstance(data['directory'], str):
            raise UpdateError('Configuração de origem inválida.')
        directory = Path(data['directory'])
        if not directory.is_absolute():
            raise UpdateError('A pasta da empresa precisa ter caminho completo.')
        return [str(directory)]
    return discover_sources()


def save_source(storage: Path, directory: str):
    import json
    import uuid
    if not Path(directory).is_absolute() or len(directory) > 1000 or '\x00' in directory:
        raise UpdateError('Escolha uma pasta sincronizada ou compartilhada, não um link do navegador.')
    no_links(storage)
    storage.mkdir(parents=True, exist_ok=True)
    destination = storage / 'source.json'
    no_links(destination)
    temporary = storage / ('source-' + uuid.uuid4().hex + '.tmp')
    with temporary.open('x', encoding='utf-8') as stream:
        json.dump(dict(schema=1, directory=directory), stream)
    os.replace(temporary, destination)

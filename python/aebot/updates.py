"""Atualizo por versão separada. Só ativo depois de conferir e testar tudo.

Este módulo não conhece regras de serviço, não baixa arquivos e não toca no
perfil do usuário. Assinar um pacote aqui não é assinar o EXE para o Windows.
"""
from __future__ import annotations
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import uuid
import zipfile
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from .update_trust import UPDATE_PUBLIC_KEY

META = '.aebot-updates'
RECEIPT = 'update-release.json'
SIGNATURE = 'update-release.sig'
MAX_METADATA = 2 * 1024**2
MAX_TOTAL = 3 * 1024**3
MAX_FILES = 5000
RELEASE_PATH = re.compile(r'^\.aebot-updates/releases/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-[a-f0-9]{12}$')


class UpdateError(ValueError):
    pass


def version(value: str) -> tuple[int, int, int]:
    if not isinstance(value, str) or not re.fullmatch(r'(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)', value) or len(value) > 24:
        raise UpdateError('Versão inválida no pacote.')
    return tuple(map(int, value.split('.')))


def relative_path(value: str) -> str:
    if not isinstance(value, str) or len(value) > 230 or not value or '\\' in value:
        raise UpdateError('Caminho inválido na atualização.')
    parts = value.split('/')
    if any(part.casefold() in (META, '.git', '.aebot-private', 'profiles', 'artifacts') or
           part.casefold().startswith('.env') for part in parts):
        raise UpdateError('Pasta privada ou reservada não pode entrar na atualização.')
    reserved = {'CON', 'PRN', 'AUX', 'NUL'} | {f'{head}{i}' for head in ('COM', 'LPT') for i in range(1, 10)}
    if any(not part or part in ('.', '..') or part[-1:] in ('.', ' ') or
           re.search(r'[<>:"|?*\x00-\x1f]', part) or part.split('.')[0].upper() in reserved for part in parts):
        raise UpdateError('Caminho inválido na atualização.')
    return PurePosixPath(value).as_posix()


def no_links(path: Path) -> None:
    # Não sigo junction, symlink ou outro reparse point para copiar arquivos.
    for item in (path, *path.parents):
        if item.exists() or item.is_symlink():
            attrs = item.lstat()
            if stat.S_ISLNK(attrs.st_mode) or getattr(attrs, 'st_file_attributes', 0) & 0x400:
                raise UpdateError('Use uma pasta local sem links ou pontos de redirecionamento.')


def local_file(root: Path, name: str) -> Path:
    target = root.joinpath(*relative_path(name).split('/'))
    no_links(target)
    if not target.is_file():
        raise UpdateError('A instalação está incompleta: ' + name)
    return target


def digest(path: Path) -> str:
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def json_object(raw: bytes) -> dict:
    if len(raw) > MAX_METADATA:
        raise UpdateError('Metadados maiores que o permitido.')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise UpdateError('Campo duplicado nos metadados.')
            result[key] = value
        return result
    try:
        result = json.loads(raw, object_pairs_hook=unique)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise UpdateError('Metadados inválidos.') from error
    if not isinstance(result, dict):
        raise UpdateError('Metadados inválidos.')
    return result


def read_inventory(directory: Path) -> dict[str, dict]:
    """Leio só os arquivos da entrega, nunca o perfil ou as pastas de updates."""
    manifest = local_file(directory, 'SHA256SUMS.txt')
    if manifest.stat().st_size > MAX_METADATA:
        raise UpdateError('Manifesto inválido.')
    records, names = {}, set()
    for line in manifest.read_text(encoding='utf-8').splitlines():
        try:
            expected, name = line.split('  ', 1)
        except ValueError as error:
            raise UpdateError('Manifesto inválido.') from error
        name = relative_path(name)
        if name.casefold() in names or not re.fullmatch('[a-f0-9]{64}', expected) or name in (RECEIPT, SIGNATURE):
            raise UpdateError('Manifesto duplicado ou inválido.')
        if name.startswith(META + '/') or name == 'SHA256SUMS.txt':
            raise UpdateError('Manifesto não pode incluir estado da instalação.')
        file = local_file(directory, name)
        names.add(name.casefold())
        records[name] = dict(sha256=expected, size=file.stat().st_size)
    records['SHA256SUMS.txt'] = dict(sha256=digest(manifest), size=manifest.stat().st_size)
    return records


def installed_version(directory: Path) -> str:
    guide = local_file(directory, 'LEIA-ME.txt')
    if guide.stat().st_size > MAX_METADATA:
        raise UpdateError('Guia de versão inválido.')
    match = re.match(r'AEBOT - protótipo Python (\d+\.\d+\.\d+) /', guide.read_text(encoding='utf-8'))
    if not match:
        raise UpdateError('Selecione a pasta extraída do AEBOT Python, não o ZIP ou o código-fonte.')
    version(match[1])
    return match[1]


def verify_files(directory: Path, records: dict) -> None:
    for name, record in records.items():
        file = local_file(directory, name)
        if file.stat().st_size != record['size'] or digest(file) != record['sha256']:
            raise UpdateError('Arquivo diferente do esperado: ' + name)


@dataclass(frozen=True)
class Release:
    data: dict
    raw: bytes
    signature: bytes

    @property
    def folder(self) -> str:
        return META + '/releases/' + self.data['toVersion'] + '-' + hashlib.sha256(self.raw).hexdigest()[:12]


def signed_release(raw: bytes, signature: bytes, public_key: bytes = UPDATE_PUBLIC_KEY) -> Release:
    if len(raw) > MAX_METADATA or len(signature) != 64:
        raise UpdateError('Assinatura ou manifesto inválido.')
    try:
        Ed25519PublicKey.from_public_bytes(public_key).verify(signature, raw)
    except (InvalidSignature, ValueError) as error:
        raise UpdateError('A atualização não foi assinada com a chave reconhecida do AEBOT.') from error
    data = json_object(raw)
    fields = {'schema', 'product', 'fromVersion', 'toVersion', 'baseManifestSha256',
              'publisher', 'releasedAt', 'notes', 'minimumLauncher', 'files'}
    if set(data) != fields or type(data['schema']) is not int or data['schema'] != 1 or data['product'] != 'AEBOT-Python' or type(data['minimumLauncher']) is not int or data['minimumLauncher'] != 1:
        raise UpdateError('Formato de atualização incompatível.')
    if version(data['toVersion']) <= version(data['fromVersion']):
        raise UpdateError('A atualização precisa ter versão superior.')
    if not isinstance(data['baseManifestSha256'], str) or not re.fullmatch('[a-f0-9]{64}', data['baseManifestSha256']):
        raise UpdateError('Identidade da versão de origem inválida.')
    for field, limit in [('publisher', 180), ('notes', 3000), ('releasedAt', 50)]:
        if not isinstance(data[field], str) or not data[field].strip() or len(data[field]) > limit:
            raise UpdateError('Descrição da atualização inválida.')
    try:
        if datetime.fromisoformat(data['releasedAt']).tzinfo is None:
            raise ValueError()
    except ValueError as error:
        raise UpdateError('Data de publicação inválida.') from error
    records = data['files']
    if not isinstance(records, dict) or not 1 <= len(records) <= MAX_FILES:
        raise UpdateError('Lista de arquivos inválida.')
    names, total = set(), 0
    for name, record in records.items():
        relative_path(name)
        if name.casefold() in names or name.startswith(META + '/') or name in (RECEIPT, SIGNATURE):
            raise UpdateError('Caminho reservado ou duplicado.')
        names.add(name.casefold())
        if not isinstance(record, dict) or set(record) != {'sha256', 'size', 'source'}:
            raise UpdateError('Registro de arquivo inválido.')
        if not isinstance(record['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', record['sha256']):
            raise UpdateError('Hash inválido.')
        if type(record['size']) is not int or not 0 <= record['size'] <= 1024**3 or record['source'] not in ('base', 'payload'):
            raise UpdateError('Tamanho ou origem inválidos.')
        total += record['size']
    if total > MAX_TOTAL or not {'AEBOT.exe', 'Abrir-AEBOT.exe', 'LEIA-ME.txt', 'SHA256SUMS.txt'} <= set(records):
        raise UpdateError('A atualização não contém uma instalação completa suportada.')
    return Release(data, raw, signature)


def inspect_update(archive: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> Release:
    if archive.stat().st_size > MAX_TOTAL:
        raise UpdateError('Arquivo de atualização maior que o permitido.')
    with zipfile.ZipFile(archive) as bundle:
        infos = bundle.infolist()
        if len(infos) > MAX_FILES + 2 or len({item.filename.casefold() for item in infos}) != len(infos):
            raise UpdateError('ZIP com arquivos duplicados ou em excesso.')
        for item in infos:
            relative_path(item.filename)
            if item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or item.flag_bits & 1 or item.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise UpdateError('Tipo de entrada não permitido no ZIP.')
        for name, maximum in [(RECEIPT, MAX_METADATA), (SIGNATURE, 64)]:
            if bundle.getinfo(name).file_size > maximum:
                raise UpdateError('Metadados maiores que o permitido.')
        release = signed_release(bundle.read(RECEIPT), bundle.read(SIGNATURE), public_key)
        expected = {RECEIPT, SIGNATURE} | {'files/' + name for name, item in release.data['files'].items() if item['source'] == 'payload'}
        if {item.filename for item in infos} != expected:
            raise UpdateError('O ZIP tem arquivos faltando ou não declarados.')
        for name, item in release.data['files'].items():
            if item['source'] == 'payload' and bundle.getinfo('files/' + name).file_size != item['size']:
                raise UpdateError('Tamanho diferente do manifesto.')
        return release


def installation_root(app_directory: Path) -> Path:
    directory = app_directory.absolute()
    if directory.parent.name == 'releases' and directory.parent.parent.name == META:
        directory = directory.parents[2]
    no_links(directory)
    if not (directory / 'AEBOT.exe').is_file() or not (directory / 'SHA256SUMS.txt').is_file():
        raise UpdateError('Selecione a pasta original que contém AEBOT.exe e resources.')
    return directory


def read_state(root: Path) -> dict | None:
    file = root / META / 'current.json'
    no_links(file)
    if not file.exists():
        return None
    if file.stat().st_size > MAX_METADATA:
        raise UpdateError('Estado da atualização maior que o permitido.')
    data = json_object(file.read_bytes())
    if set(data) != {'schema', 'active', 'previous'} or data['schema'] != 1:
        raise UpdateError('Estado da atualização inválido. A versão original foi preservada.')
    if not isinstance(data['active'], str) or not RELEASE_PATH.fullmatch(data['active']):
        raise UpdateError('Versão ativa inválida.')
    if data['previous'] != '.' and (not isinstance(data['previous'], str) or not RELEASE_PATH.fullmatch(data['previous'])):
        raise UpdateError('Versão anterior inválida.')
    return data


def read_receipt(directory: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> Release:
    receipt, signature = local_file(directory, RECEIPT), local_file(directory, SIGNATURE)
    if receipt.stat().st_size > MAX_METADATA or signature.stat().st_size != 64:
        raise UpdateError('Comprovante da atualização inválido.')
    return signed_release(receipt.read_bytes(), signature.read_bytes(), public_key)


def verify_release_directory(directory: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> Release:
    release = read_receipt(directory, public_key)
    verify_files(directory, release.data['files'])
    if installed_version(directory) != release.data['toVersion']:
        raise UpdateError('O aplicativo não corresponde à versão publicada.')
    return release


def current_directory(root: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> Path:
    state = read_state(root)
    if not state:
        return root
    target = root.joinpath(*state['active'].split('/'))
    release = verify_release_directory(target, public_key)
    if release.folder != state['active']:
        raise UpdateError('Identidade da versão ativa inválida.')
    return target


@contextmanager
def update_lock(root: Path):
    import msvcrt
    lock = root / META / 'update.lock'
    no_links(lock)
    lock.parent.mkdir(exist_ok=True)
    with lock.open('a+b') as stream:
        if stream.tell() == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        try:
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as error:
            raise UpdateError('Já há uma atualização em andamento nesta pasta.') from error
        try:
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def activate(root: Path, active: str, previous: str) -> None:
    # A troca de um arquivo pequeno é a última etapa. Não substituo o EXE
    # em uso e não apago a versão anterior se faltar energia ou o teste falhar.
    directory = root / META
    pointer = directory / 'current.json'
    no_links(pointer)
    temporary = directory / ('current-' + uuid.uuid4().hex + '.tmp')
    with temporary.open('xb') as stream:
        stream.write(json.dumps(dict(schema=1, active=active, previous=previous)).encode())
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, pointer)


def check_application(directory: Path) -> None:
    result = subprocess.run([str(local_file(directory, 'AEBOT.exe')), '--check'], timeout=90,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode != 0:
        raise UpdateError('A versão nova não passou no teste. A versão anterior continua ativa.')


def prepare_release(release: Release, archive: Path, staging: Path, source: Path | None = None):
    """Materializo só os nomes assinados; não extraio o ZIP livremente."""
    with zipfile.ZipFile(archive) as bundle:
        if bundle.read(RECEIPT) != release.raw or bundle.read(SIGNATURE) != release.signature:
            raise UpdateError('O pacote mudou durante a leitura.')
        for name, item in release.data['files'].items():
            target = staging.joinpath(*name.split('/'))
            target.parent.mkdir(parents=True, exist_ok=True)
            if item['source'] == 'base':
                if source is None:
                    raise UpdateError('Uma instalação completa não pode depender de outra versão.')
                shutil.copyfile(local_file(source, name), target)
            else:
                with bundle.open('files/' + name) as incoming, target.open('xb') as outgoing:
                    written = 0
                    for block in iter(lambda: incoming.read(1024**2), b''):
                        written += len(block)
                        if written > item['size']:
                            raise UpdateError('Conteúdo maior que o tamanho publicado.')
                        outgoing.write(block)
    (staging / RECEIPT).write_bytes(release.raw)
    (staging / SIGNATURE).write_bytes(release.signature)


def install_full(root: Path, archive: Path, *, public_key: bytes = UPDATE_PUBLIC_KEY,
                 validator=check_application, cancelled=None) -> str:
    """Instalo por usuário sem gravar em Program Files ou alterar o Windows."""
    root = root.absolute()
    if str(root).startswith('\\\\'):
        raise UpdateError('Instale em uma pasta local deste computador, não na pasta compartilhada da empresa.')
    no_links(root)
    if root.exists():
        raise UpdateError('A pasta de destino já existe. Use Atualizar para uma instalação existente ou escolha outra pasta vazia nova.')
    release = inspect_update(archive, public_key)
    if release.data['fromVersion'] != '0.0.0' or release.data['baseManifestSha256'] != '0' * 64 or any(
            item['source'] != 'payload' for item in release.data['files'].values()):
        raise UpdateError('Este não é um pacote de primeira instalação.')
    root.parent.mkdir(parents=True, exist_ok=True)
    needed = sum(item['size'] for item in release.data['files'].values()) + 50 * 1024**2
    if shutil.disk_usage(root.parent).free < needed:
        raise UpdateError('Não há espaço para preparar a instalação completa.')
    staging = root.parent / (root.name + '.install-' + uuid.uuid4().hex)
    staging.mkdir()
    prepare_release(release, archive, staging)
    verify_release_directory(staging, public_key)
    if cancelled and cancelled():
        raise UpdateError('Instalação cancelada antes da ativação.')
    validator(staging)
    if cancelled and cancelled():
        raise UpdateError('Instalação cancelada antes da ativação.')
    staging.rename(root)
    return release.data['toVersion']


def apply_update(root: Path, archive: Path, *, public_key: bytes = UPDATE_PUBLIC_KEY,
                 validator=check_application, cancelled=None) -> str:
    root = installation_root(root)
    release = inspect_update(archive, public_key)
    with update_lock(root):
        source = current_directory(root, public_key)
        if installed_version(source) != release.data['fromVersion']:
            raise UpdateError('Este pacote é para a versão ' + release.data['fromVersion'] + '. Selecione a atualização correspondente à sua instalação.')
        if digest(local_file(source, 'SHA256SUMS.txt')) != release.data['baseManifestSha256']:
            raise UpdateError('A base instalada foi alterada ou não corresponde a esta atualização.')
        final = root.joinpath(*release.folder.split('/'))
        no_links(final)
        if final.exists():
            # Uma ativação interrompida pode ser retomada, mas nunca aproveito
            # um estágio parcial ou uma pasta que não passou pela assinatura.
            existing = verify_release_directory(final, public_key)
            if existing.raw != release.raw:
                raise UpdateError('A pasta de destino já existe com outro conteúdo.')
            validator(final)
        else:
            required = sum(item['size'] for item in release.data['files'].values()) + 50 * 1024**2
            if shutil.disk_usage(root).free < required:
                raise UpdateError('Não há espaço para preparar a versão nova e preservar a anterior.')
            staging = root / META / ('staging-' + uuid.uuid4().hex)
            staging.mkdir()
            prepare_release(release, archive, staging, source)
            verify_release_directory(staging, public_key)
            validator(staging)
            final.parent.mkdir(exist_ok=True)
            staging.rename(final)
        # O lançador estável é criado uma vez. A versão original não recebe
        # arquivos novos por cima dos antigos nem tem seus dados removidos.
        launcher = root / 'Abrir-AEBOT.exe'
        no_links(launcher)
        if not launcher.exists():
            with local_file(final, 'Abrir-AEBOT.exe').open('rb') as incoming, launcher.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
        state = read_state(root)
        previous = state['active'] if state else '.'
        if cancelled and cancelled():
            raise UpdateError('Atualização cancelada antes da ativação. A versão anterior foi preservada.')
        activate(root, release.folder, previous)
    return release.data['toVersion']


def launch_application(root: Path):
    root = installation_root(root)
    target = current_directory(root)
    if target == root:
        if (root / RECEIPT).exists():
            verify_release_directory(root)
        else:
            verify_files(root, read_inventory(root))
    subprocess.Popen([str(target / 'AEBOT.exe')], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))


def rollback(root: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> str:
    root = installation_root(root)
    with update_lock(root):
        state = read_state(root)
        if not state:
            raise UpdateError('Não há atualização aplicada nesta instalação.')
        active = root.joinpath(*state['active'].split('/'))
        # Voltar precisa funcionar mesmo se um arquivo da versão ativa foi
        # corrompido. Confiro seu comprovante assinado, mas não a executo.
        receipt = read_receipt(active, public_key)
        if receipt.folder != state['active']:
            raise UpdateError('Identidade da versão ativa inválida.')
        target = state['previous']
        if target == '.':
            if digest(local_file(root, 'SHA256SUMS.txt')) != receipt.data['baseManifestSha256']:
                raise UpdateError('A versão original não corresponde ao backup esperado.')
            verify_files(root, read_inventory(root))
            # Ausência do ponteiro significa usar a instalação original.
            # Guardo o estado em vez de apagar o histórico da atualização.
            destination = root / META / ('rollback-' + uuid.uuid4().hex + '.json')
            (root / META / 'current.json').rename(destination)
            return installed_version(root)
        directory = root.joinpath(*target.split('/'))
        verify_release_directory(directory, public_key)
        activate(root, target, state['active'])
        return installed_version(directory)

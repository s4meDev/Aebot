"""Catálogo assinado e cópia de pacotes da pasta sincronizada, só por pedido."""
from dataclasses import dataclass
from datetime import datetime
import base64
import hashlib
import json
from pathlib import Path
import stat
import uuid
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from .update_trust import UPDATE_PUBLIC_KEY
from .updates import (UpdateError, MAX_METADATA, MAX_TOTAL, digest, inspect_update,
    json_object, no_links, version)

CATALOG = 'channel.json'


def canonical(data: dict) -> bytes:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def checked_source_path(target: Path):
    # Só o leitor da origem permite placeholders CLOUD do OneDrive. Isso não
    # autoriza links, junctions ou reparse points no destino executável local.
    for item in (target, *target.parents):
        try:
            attrs = item.lstat()
        except FileNotFoundError:
            continue
        tag = getattr(attrs, 'st_reparse_tag', 0)
        cloud = tag & 0xFFFF0FFF == 0x9000001A
        if stat.S_ISLNK(attrs.st_mode) or (getattr(attrs, 'st_file_attributes', 0) & 0x400 and not cloud):
            raise UpdateError('A origem contém um link ou redirecionamento não permitido.')


def source_file(folder: Path, relative: str) -> Path:
    from .updates import relative_path
    target = folder.joinpath(*relative_path(relative).split('/'))
    checked_source_path(target)
    if not target.is_file():
        if not target.exists():
            raise FileNotFoundError(target)
        raise UpdateError('Arquivo da distribuição não encontrado.')
    return target


@dataclass(frozen=True)
class ChannelRelease:
    kind: str
    fromVersion: str
    toVersion: str
    baseManifestSha256: str
    sha256: str
    size: int
    notes: str

    @property
    def filename(self):
        return 'packages/' + self.sha256 + '.aebot-update'

    def to_dict(self):
        from dataclasses import asdict
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        fields = {'kind', 'fromVersion', 'toVersion', 'baseManifestSha256', 'sha256', 'size', 'notes'}
        if not isinstance(data, dict) or set(data) != fields:
            raise UpdateError('Cadastro de versão inválido.')
        if data['kind'] not in ('full', 'delta') or version(data['toVersion']) <= version(data['fromVersion']):
            raise UpdateError('Versões incompatíveis no canal.')
        import re
        if any(not isinstance(data[key], str) or not re.fullmatch('[a-f0-9]{64}', data[key]) for key in ('sha256', 'baseManifestSha256')):
            raise UpdateError('Hash do canal inválido.')
        if type(data['size']) is not int or not 1 <= data['size'] <= MAX_TOTAL or not isinstance(data['notes'], str) or not 1 <= len(data['notes']) <= 3000:
            raise UpdateError('Tamanho ou descrição do pacote inválido.')
        if data['kind'] == 'full' and (data['fromVersion'] != '0.0.0' or data['baseManifestSha256'] != '0' * 64):
            raise UpdateError('Instalação completa inválida.')
        if data['kind'] == 'delta' and data['fromVersion'] == '0.0.0':
            raise UpdateError('Atualização diferencial inválida.')
        return cls(**data)


@dataclass(frozen=True)
class UpdateChannel:
    latest: str
    releases: tuple[ChannelRelease, ...]
    published_at: str

    @classmethod
    def verify(cls, raw: bytes, public_key: bytes = UPDATE_PUBLIC_KEY):
        envelope = json_object(raw)
        if set(envelope) != {'payload', 'signature'} or not isinstance(envelope['payload'], dict) or not isinstance(envelope['signature'], str):
            raise UpdateError('Canal de distribuição inválido.')
        try:
            signature = base64.b64decode(envelope['signature'], validate=True)
            Ed25519PublicKey.from_public_bytes(public_key).verify(signature, canonical(envelope['payload']))
        except (ValueError, InvalidSignature) as error:
            raise UpdateError('O canal não tem assinatura reconhecida do AEBOT.') from error
        data = envelope['payload']
        if set(data) != {'schema', 'product', 'publishedAt', 'latest', 'releases'} or type(data['schema']) is not int or data['schema'] != 1 or data['product'] != 'AEBOT-Python':
            raise UpdateError('Formato de canal incompatível.')
        version(data['latest'])
        try:
            if datetime.fromisoformat(data['publishedAt']).tzinfo is None:
                raise ValueError()
        except (ValueError, TypeError) as error:
            raise UpdateError('Data do canal inválida.') from error
        if not isinstance(data['releases'], list) or not 1 <= len(data['releases']) <= 100:
            raise UpdateError('Lista de versões inválida.')
        releases = tuple(ChannelRelease.from_dict(item) for item in data['releases'])
        if any(item.toVersion != data['latest'] for item in releases) or len({(r.kind, r.fromVersion, r.baseManifestSha256) for r in releases}) != len(releases):
            raise UpdateError('Catálogo duplicado ou com destinos divergentes.')
        return cls(data['latest'], releases, data['publishedAt'])

    def select(self, installed: str | None, manifest_hash: str | None) -> tuple[str, ChannelRelease | None]:
        if installed and version(installed) >= version(self.latest):
            return 'current', None
        candidates = [item for item in self.releases if
            (installed is None and item.kind == 'full') or
            (installed is not None and item.kind == 'delta' and item.fromVersion == installed and item.baseManifestSha256 == manifest_hash)]
        return ('available', candidates[0]) if candidates else ('incompatible', None)


def check_sources(sources: list[str], installed: str | None, manifest_hash: str | None,
                  public_key: bytes = UPDATE_PUBLIC_KEY) -> dict:
    if not sources:
        raise UpdateError('Não encontrei a pasta AEBOT sincronizada. Use Escolher pasta uma vez ou sincronize Funcionalidades/AEBOT pelo OneDrive.')
    found = []
    for source in dict.fromkeys(sources):
        if not Path(source).is_absolute():
            raise UpdateError('A origem da distribuição precisa ter caminho completo.')
        try:
            path = source_file(Path(source), CATALOG)
        except FileNotFoundError:
            continue
        if path.stat().st_size > MAX_METADATA:
            raise UpdateError('Canal maior que o permitido.')
        channel = UpdateChannel.verify(path.read_bytes(), public_key)
        found.append((source, channel))
    if not found:
        raise UpdateError('A pasta de distribuição não está disponível ou ainda não sincronizou. A versão instalada continua funcionando.')
    if len(found) > 1:
        raise UpdateError('Encontrei mais de uma pasta AEBOT. Use Escolher pasta para confirmar a origem, sem escolher uma versão por adivinhação.')
    source, channel = found[0]
    status, release = channel.select(installed, manifest_hash)
    return dict(status=status, source=source, latest=channel.latest, publishedAt=channel.published_at,
        release=release.to_dict() if release else None)


def fetch_release(source: str, selection: dict, cache: Path, public_key: bytes = UPDATE_PUBLIC_KEY) -> Path:
    release = ChannelRelease.from_dict(selection)
    # Reconfiro o canal antes de baixar: não uso um anúncio antigo que já foi
    # substituído nem aceito arquivo avulso no lugar do pacote publicado.
    checked = check_sources([source], None if release.kind == 'full' else release.fromVersion,
        None if release.kind == 'full' else release.baseManifestSha256, public_key)
    if checked['release'] != selection:
        raise UpdateError('A distribuição mudou. Procure atualizações novamente.')
    no_links(cache)
    cache.mkdir(parents=True, exist_ok=True)
    destination = cache / (release.sha256 + '.aebot-update')
    no_links(destination)
    if destination.exists():
        if destination.stat().st_size == release.size and digest(destination) == release.sha256:
            return destination
        raise UpdateError('O pacote em cache foi alterado. Não vou usá-lo.')
    incoming = source_file(Path(source), release.filename)
    if incoming.stat().st_size != release.size:
        raise UpdateError('O pacote ainda não está sincronizado por completo.')
    import shutil
    if shutil.disk_usage(cache).free < release.size + 50 * 1024**2:
        raise UpdateError('Não há espaço para baixar o pacote de atualização.')
    temporary = cache / (uuid.uuid4().hex + '.part')
    total, checksum = 0, hashlib.sha256()
    with incoming.open('rb') as origin, temporary.open('xb') as output:
        for block in iter(lambda: origin.read(1024**2), b''):
            total += len(block)
            if total > release.size:
                raise UpdateError('Arquivo maior que o publicado.')
            checksum.update(block)
            output.write(block)
    if total != release.size or checksum.hexdigest() != release.sha256:
        raise UpdateError('O download não passou na verificação. A versão atual foi preservada.')
    actual = inspect_update(temporary, public_key).data
    if (actual['fromVersion'], actual['toVersion'], actual['baseManifestSha256']) != (release.fromVersion, release.toVersion, release.baseManifestSha256):
        raise UpdateError('O pacote não corresponde ao anúncio assinado.')
    temporary.rename(destination)
    return destination

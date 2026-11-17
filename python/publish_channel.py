"""Publico pacotes imutáveis primeiro e o catálogo assinado por último."""
import argparse
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import uuid
from cryptography.hazmat.primitives import serialization
from aebot.update_trust import UPDATE_PUBLIC_KEY
from aebot.updates import inspect_update, digest, no_links, UpdateError
from aebot.update_channel import canonical, UpdateChannel, ChannelRelease, CATALOG, checked_source_path


def publish(directory: Path, archives: list[Path], key, *, installer: Path | None = None) -> dict:
    directory = directory.absolute()
    if not directory.name.casefold() == 'aebot' or any(part.name.casefold() == 'autoforms' for part in directory.parents):
        raise UpdateError('Publique na pasta AEBOT separada; não na pasta AutoForms ou na biblioteca inteira.')
    checked_source_path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    packages = directory / 'packages'
    checked_source_path(packages)
    packages.mkdir(exist_ok=True)
    public = key.public_key().public_bytes_raw()
    releases = []
    for archive in archives:
        release = inspect_update(archive, public).data
        checksum = digest(archive)
        item = ChannelRelease('full' if release['fromVersion'] == '0.0.0' else 'delta',
            release['fromVersion'], release['toVersion'], release['baseManifestSha256'], checksum,
            archive.stat().st_size, release['notes'])
        destination = directory / item.filename
        checked_source_path(destination)
        if destination.exists():
            if digest(destination) != checksum:
                raise UpdateError('Um pacote existente foi alterado; não sobrescrevo arquivos publicados.')
        else:
            temporary = packages / (uuid.uuid4().hex + '.upload')
            shutil.copyfile(archive, temporary)
            if digest(temporary) != checksum:
                raise UpdateError('Falha na cópia para distribuição.')
            temporary.rename(destination)
        releases.append(item)
    if not releases:
        raise UpdateError('Informe pelo menos um pacote.')
    versions = {item.toVersion for item in releases}
    if len(versions) != 1:
        raise UpdateError('Os pacotes desta publicação devem apontar para a mesma versão nova.')
    payload = dict(schema=1, product='AEBOT-Python', publishedAt=datetime.now(timezone.utc).isoformat(),
        latest=releases[0].toVersion, releases=[item.to_dict() for item in releases])
    raw = canonical(dict(payload=payload, signature=base64.b64encode(key.sign(canonical(payload))).decode()))
    UpdateChannel.verify(raw, public)
    # Confiro a versão antes de trocar qualquer arquivo de entrada público.
    current = directory / CATALOG
    checked_source_path(current)
    previous = None
    if current.exists():
        previous = current.read_bytes()
        previous_channel = UpdateChannel.verify(previous, public)
        from aebot.updates import version
        if version(payload['latest']) < version(previous_channel.latest):
            raise UpdateError('Não publico um catálogo anterior por cima do atual.')
    if installer:
        # O instalador público é uma cópia do lançador; nunca contém a chave
        # privada. Guardo cada binário por hash antes de atualizar o nome fixo.
        immutable = directory / 'installers'
        checked_source_path(immutable)
        immutable.mkdir(exist_ok=True)
        checksum = digest(installer)
        stored = immutable / (checksum + '.exe')
        checked_source_path(stored)
        if not stored.exists():
            shutil.copyfile(installer, stored)
        if digest(stored) != checksum:
            raise UpdateError('O instalador público não passou na conferência.')
        temporary_installer = directory / ('installer-' + uuid.uuid4().hex + '.tmp')
        shutil.copyfile(stored, temporary_installer)
        import os
        public_installer = directory / 'Instalar-AEBOT.exe'
        checked_source_path(public_installer)
        os.replace(temporary_installer, public_installer)
    if previous is not None:
        history = directory / 'history'
        checked_source_path(history)
        history.mkdir(exist_ok=True)
        backup = history / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex + '.json')
        backup.write_bytes(previous)
    temporary = directory / ('channel-' + uuid.uuid4().hex + '.tmp')
    temporary.write_bytes(raw)
    import os
    os.replace(temporary, current)
    return dict(latest=payload['latest'], packages=len(releases), directory=str(directory))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--package', type=Path, action='append', required=True)
    parser.add_argument('--installer', type=Path)
    args = parser.parse_args()
    private = Path(__file__).resolve().parents[1] / '.aebot-private/update-signing-key.pem'
    key = serialization.load_pem_private_key(private.read_bytes(), password=None)
    if key.public_key().public_bytes_raw() != UPDATE_PUBLIC_KEY:
        raise UpdateError('A chave não corresponde ao publicador do aplicativo.')
    print(json.dumps(publish(args.directory, args.package, key, installer=args.installer), ensure_ascii=False))


if __name__ == '__main__':
    main()

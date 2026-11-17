"""Confiro a central preparada e junto os arquivos públicos para transferência."""
import argparse
from pathlib import Path
import shutil
import zipfile
from aebot.update_channel import CATALOG, UpdateChannel
from aebot.updates import digest, inspect_update, no_links


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.directory.absolute()
    no_links(root)
    if root.name != 'AEBOT' or args.output.exists():
        raise ValueError('Use a central AEBOT e um ZIP novo, sem substituir uma entrega.')
    channel = UpdateChannel.verify((root / CATALOG).read_bytes())
    permitted = {CATALOG, 'Instalar-AEBOT.exe', '00-COMECE-AQUI.md'}
    for release in channel.releases:
        package = root / release.filename
        no_links(package)
        if package.stat().st_size != release.size or digest(package) != release.sha256:
            raise ValueError('Pacote diferente do catálogo.')
        manifest = inspect_update(package).data
        if (manifest['fromVersion'], manifest['toVersion'], manifest['baseManifestSha256']) != (
                release.fromVersion, release.toVersion, release.baseManifestSha256):
            raise ValueError('Identidade de pacote diferente do canal.')
        permitted.add(release.filename)
    installer = root / 'Instalar-AEBOT.exe'
    no_links(installer)
    immutable = 'installers/' + digest(installer) + '.exe'
    if not (root / immutable).is_file() or digest(root / immutable) != digest(installer):
        raise ValueError('Instalador diferente da cópia imutável publicada.')
    permitted.add(immutable)
    guide = Path(__file__).resolve().parents[1] / 'docs/DISTRIBUIR-EMPRESA.md'
    target = root / '00-COMECE-AQUI.md'
    no_links(target)
    if target.exists():
        raise ValueError('O guia já existe; preserve esta central e prepare outra entrega.')
    shutil.copyfile(guide, target)
    actual = {file.relative_to(root).as_posix() for file in root.rglob('*') if file.is_file()}
    if actual != permitted:
        raise ValueError('Há arquivos extras ou faltantes na central nova.')
    with zipfile.ZipFile(args.output, 'x', zipfile.ZIP_DEFLATED, compresslevel=1, allowZip64=True) as bundle:
        for name in sorted(permitted):
            file = root / name
            no_links(file)
            bundle.write(file, 'AEBOT/' + name)
    with zipfile.ZipFile(args.output) as bundle:
        if bundle.testzip():
            raise ValueError('O ZIP não passou na conferência CRC.')
    print(f'Central {channel.latest} conferida: {args.output} ({args.output.stat().st_size / 1024**2:.1f} MiB)')


if __name__ == '__main__':
    main()

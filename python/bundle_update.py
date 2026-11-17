"""Monto a transição única para quem ainda não tem botão de atualizar."""
import argparse
from pathlib import Path
import shutil
import zipfile
from aebot.updates import inspect_update


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--launcher', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    args = parser.parse_args()
    inspect_update(args.package)
    if args.output_directory.exists():
        raise SystemExit('Preservo entregas anteriores. Use um destino novo.')
    output = args.output_directory
    output.mkdir()
    root = Path(__file__).resolve().parents[1]
    shutil.copy2(args.launcher, output / 'Atualizar-AEBOT.exe')
    shutil.copy2(args.package, output / args.package.name)
    shutil.copy2(root / 'docs/ATUALIZAR-AEBOT.md', output / '00-COMECE-AQUI.md')
    archive_path = output.parent / (output.name + '.zip')
    with zipfile.ZipFile(archive_path, 'x', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        for file in sorted(output.iterdir()):
            archive.write(file, output.name + '/' + file.name)
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip():
            raise ValueError('CRC inválido.')
    print(f'Transição conferida: {archive_path} ({archive_path.stat().st_size / 1024**2:.1f} MiB)')


if __name__ == '__main__':
    main()

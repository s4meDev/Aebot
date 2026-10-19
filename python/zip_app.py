"""Confiro os bytes antes de criar o ZIP que será transferido ao outro PC."""
from pathlib import Path
import hashlib
import zipfile
from package_app import OUTPUT


def archive_path_for(output: Path) -> Path:
    # with_suffix descartaria o último número da versão (0.1.1 -> 0.1.zip).
    return output.parent / (output.name + '.zip')


def main() -> None:
    manifest = OUTPUT / 'SHA256SUMS.txt'
    listed = []
    for line in manifest.read_text(encoding='utf-8').splitlines():
        digest, relative = line.split('  ', 1)
        file = OUTPUT / relative
        if not file.resolve().is_relative_to(OUTPUT.resolve()) or file.is_symlink() or file.is_junction():
            raise ValueError('Caminho inválido no pacote.')
        with file.open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() != digest:
                raise ValueError(f'Arquivo diferente do manifesto: {relative}')
        listed.append(file)
    expected = set(listed) | {manifest}
    actual = {file for file in OUTPUT.rglob('*') if file.is_file()}
    if expected != actual:
        raise ValueError('Há arquivos faltando ou adicionais na pasta de entrega.')
    archive_path = archive_path_for(OUTPUT)
    with zipfile.ZipFile(archive_path, 'x', zipfile.ZIP_DEFLATED, compresslevel=1, allowZip64=True) as archive:
        for file in sorted(expected):
            archive.write(file, file.relative_to(OUTPUT.parent))
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip():
            raise ValueError('A verificação CRC do ZIP falhou.')
    print(f'ZIP conferido: {archive_path} ({archive_path.stat().st_size / 1024**2:.1f} MiB)')


if __name__ == '__main__':
    main()

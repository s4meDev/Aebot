"""Junto instalador, pacote assinado e manual para levar à empresa em um ZIP."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
from aebot.updates import digest, inspect_update, no_links

ROOT = Path(__file__).resolve().parents[1]
GUIDES = [('docs/COMECE-TESTE-ASFALTO.txt', '00-COMECE-AQUI.txt'),
          ('docs/INSTALAR-TESTE-ASFALTO.md', '00-COMECE-AQUI.md'),
          ('docs/ROTEIRO-TESTE-ASFALTO.md', '01-ROTEIRO-DE-TESTE.md'),
          ('docs/FEEDBACK-PYTHON.md', '02-FEEDBACK.md'),
          ('docs/ENTREGA-TESTES-2026-11-16.md', '03-VALIDACAO-DA-ENTREGA.md')]


def permitted_names(output: Path):
    packages = list(output.glob('*.aebot-update'))
    if len(packages) != 1:
        raise ValueError('A entrega precisa de exatamente um pacote completo.')
    return {'Instalar-AEBOT.exe', 'SHA256SUMS.txt', packages[0].name} | {name for _, name in GUIDES}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    package, output = args.package.absolute(), args.output.absolute()
    no_links(package)
    no_links(output)
    archive = output.parent / (output.name + '.zip')
    stage = ROOT / 'python/build' / (output.name + '-setup')
    if output.exists() or archive.exists() or stage.exists():
        raise SystemExit('Preservo entregas anteriores. Use um nome novo para preparar esta instalação.')
    data = inspect_update(package).data
    if data['fromVersion'] != '0.0.0':
        raise SystemExit('Use o pacote assinado completo, não um diferencial.')
    stage.mkdir(parents=True)
    metadata = stage / 'offline-payload.json'
    metadata.write_text(json.dumps(dict(version=data['toVersion'], filename=package.name,
        sha256=digest(package), size=package.stat().st_size)), encoding='utf-8')
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--onefile', '--windowed',
        '--name', 'Instalar-AEBOT', '--paths', str(ROOT / 'python'),
        '--add-data', str(metadata) + ';.', '--distpath', str(stage / 'frozen'),
        '--workpath', str(stage / 'work'), '--specpath', str(stage),
        str(ROOT / 'python/offline_setup.py')], check=True, cwd=ROOT)
    output.mkdir(parents=True)
    shutil.copy2(stage / 'frozen/Instalar-AEBOT.exe', output / 'Instalar-AEBOT.exe')
    shutil.copy2(package, output / package.name)
    refresh_guides(output)
    print(json.dumps(dict(prepared=str(output), version=data['toVersion'], files=len(list(output.iterdir())),
        note='Execute o EXE gerado com --check antes de publicar o ZIP.'), ensure_ascii=False))


def refresh_guides(output: Path):
    # Só atualizo os guias antes de fechar o ZIP. Pacote/modelo e EXEs testados
    # não são recompilados nem alterados por esta função.
    no_links(output)
    if output.with_name(output.name + '.zip').exists():
        raise ValueError('O ZIP já foi fechado; preserve a entrega e prepare outra.')
    permitted = permitted_names(output)
    if any(not file.is_file() or file.name not in permitted for file in output.iterdir()):
        raise ValueError('Há itens fora da lista pública de entrega.')
    for source, name in GUIDES:
        no_links(output / name)
        shutil.copy2(ROOT / source, output / name)
    records = []
    for file in sorted(output.iterdir()):
        no_links(file)
        if file.name != 'SHA256SUMS.txt':
            records.append(digest(file) + '  ' + file.name)
    no_links(output / 'SHA256SUMS.txt')
    (output / 'SHA256SUMS.txt').write_text('\n'.join(records) + '\n', encoding='utf-8')


def zip_delivery(output: Path):
    """Fecho a entrega só depois do teste do instalador congelado."""
    output = output.absolute()
    no_links(output)
    manifest = output / 'SHA256SUMS.txt'
    expected = {manifest}
    permitted = permitted_names(output)
    for line in manifest.read_text(encoding='utf-8').splitlines():
        hash_value, name = line.split('  ', 1)
        if name not in permitted or Path(name).name != name or '/' in name or '\\' in name:
            raise ValueError('Caminho fora da pasta de entrega.')
        file = output / name
        no_links(file)
        if digest(file) != hash_value:
            raise ValueError('Arquivo mudou depois da preparação.')
        expected.add(file)
    if expected != set(output.iterdir()) or {p.name for p in expected} != permitted:
        raise ValueError('A pasta contém itens não declarados.')
    path = output.parent / (output.name + '.zip')
    with zipfile.ZipFile(path, 'x', zipfile.ZIP_STORED, allowZip64=True) as bundle:
        for file in sorted(expected):
            bundle.write(file, output.name + '/' + file.name)
    with zipfile.ZipFile(path) as bundle:
        if bundle.testzip():
            raise ValueError('Falha CRC no ZIP final.')
    print(json.dumps(dict(zip=str(path), bytes=path.stat().st_size, sha256=digest(path))))


if __name__ == '__main__':
    main()

"""Gero uma pasta portátil nova, sem copiar perfil, conversas ou credenciais."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
import sys
from aebot.runtime import verify_model
from aebot import __version__
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'python/dist' / f'AEBOT-Python-{__version__}'


def copy_guides(directory: Path) -> None:
    for name in ('LEIA-ME.txt', 'THIRD-PARTY-NOTICES.md'):
        shutil.copy2(ROOT / 'python' / name, directory / name)
    shutil.copy2(ROOT / 'python/LEIA-ME.txt', directory / '00-COMECE-AQUI.txt')
    shutil.copy2(ROOT / 'docs/REVISAO-PYTHON-090.md', directory / 'RESULTADOS-TESTES.md')
    shutil.copy2(ROOT / 'docs/DISTRIBUIR-EMPRESA.md', directory / 'PASTA-DA-EMPRESA.md')
    shutil.copy2(ROOT / 'docs/ATUALIZAR-AEBOT.md', directory / 'COMO-ATUALIZAR.md')
    shutil.copy2(ROOT / 'docs/USAR-ASFALTO.md', directory / 'COMO-USAR.md')
    shutil.copy2(ROOT / 'docs/FEEDBACK-PYTHON.md', directory / 'GUIA-FEEDBACK.md')
    for source, target in [('docs/FLUXO-ASFALTO.html', 'FLUXO-ASFALTO.html'), ('docs/REGRAS-ASFALTO.md', 'REGRAS-ASFALTO.md')]:
        shutil.copy2(ROOT / source, directory / target)
    for name in ('FLUXO-ANALISE.json', 'FLUXO-ANALISE.mmd', 'FLUXO-ANALISE.svg', 'CONFERENCIA-DOCUMENTO-ASFALTO.md'):
        shutil.copy2(ROOT / 'docs' / name, directory / name)


def write_manifest(directory: Path) -> int:
    # O próprio manifesto não entra no hash. Posso atualizar os guias depois
    # do teste do EXE e regenerar os hashes antes de fechar o ZIP.
    hashes = []
    for file in sorted(directory.rglob('*')):
        if file.is_file() and file != directory / 'SHA256SUMS.txt':
            with file.open('rb') as source:
                digest = hashlib.file_digest(source, 'sha256').hexdigest()
            hashes.append(f'{digest}  {file.relative_to(directory).as_posix()}')
    (directory / 'SHA256SUMS.txt').write_text('\n'.join(hashes) + '\n', encoding='utf-8')
    return len(hashes)


def main() -> None:
    if OUTPUT.exists():
        raise SystemExit('A pasta de entrega já existe. Preserve-a e use uma nova versão; não sobrescrevo entregas.')
    verify_model(ROOT)
    stage = ROOT / 'python/build' / __version__
    if stage.exists():
        raise SystemExit('O estágio desta versão já existe. Preserve-o e gere outra versão; não limpo pastas automaticamente.')
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--onedir', '--windowed',
        '--name', 'AEBOT', '--paths', str(ROOT / 'python'),
        '--distpath', str(stage / 'frozen'), '--workpath', str(stage / 'work'),
        '--specpath', str(stage), str(ROOT / 'python/main.py')], check=True, cwd=ROOT)
    shutil.copytree(stage / 'frozen/AEBOT', OUTPUT)
    # Este EXE pequeno é o ponto estável. A IA continua no aplicativo normal;
    # o lançador só confere/abre a versão ativa e aplica pacotes escolhidos.
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--onefile', '--windowed',
        '--name', 'Abrir-AEBOT', '--paths', str(ROOT / 'python'),
        '--distpath', str(stage / 'launcher'), '--workpath', str(stage / 'launcher-work'),
        '--specpath', str(stage / 'launcher-spec'), str(ROOT / 'python/updater_main.py')], check=True, cwd=ROOT)
    shutil.copy2(stage / 'launcher/Abrir-AEBOT.exe', OUTPUT / 'Abrir-AEBOT.exe')
    resources = OUTPUT / 'resources'
    for relative in ('src/data/languageAliases.json', 'schemas/rulesStore.schema.json', 'schemas/catalogProfile.schema.json', 'python/catalogProfile.json', 'python/reranker.lock.json'):
        target = resources / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    catalog_target = resources / 'src/data/rulesStore.json'
    catalog_target.write_text(json.dumps(RuleStore(ROOT, prototype=True).data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copytree(ROOT / 'python/assets', resources / 'python/assets')
    shutil.copytree(ROOT / 'python/models/bge', resources / 'python/models/bge')
    copy_guides(OUTPUT)
    licenses = OUTPUT / 'LICENSES'
    licenses.mkdir()
    packages = sorted(importlib.metadata.distributions(), key=lambda item: item.metadata['Name'].lower())
    versions = []
    for distribution in packages:
        name = distribution.metadata['Name']
        versions.append(f'{name}=={distribution.version}')
        for item in distribution.files or []:
            if any(token in item.name.lower() for token in ('license', 'copying', 'notice')):
                source = Path(distribution.locate_file(item))
                if source.is_file():
                    target = licenses / name / Path(str(item))
                    # Distribuições conhecidas não podem escapar de LICENSES.
                    if not target.resolve().is_relative_to(licenses.resolve()):
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
    apache = next(licenses.glob('huggingface_hub/**/LICENSE'))
    shutil.copy2(apache, licenses / 'BGE-Apache-2.0.txt')
    base_python = Path(sys.base_prefix)
    for relative in ('LICENSE.txt', 'tcl/tcl8.6/license.terms', 'tcl/tk8.6/license.terms'):
        source = base_python / relative
        if source.is_file():
            shutil.copy2(source, licenses / ('Python-' + relative.replace('/', '-')))
    (OUTPUT / 'DEPENDENCIAS.txt').write_text('\n'.join(versions) + '\n', encoding='utf-8')
    count = write_manifest(OUTPUT)
    print(json.dumps(dict(directory=str(OUTPUT), files=count), ensure_ascii=False))


if __name__ == '__main__':
    main()

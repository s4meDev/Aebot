"""Gero uma pasta portátil nova, sem copiar perfil, conversas ou credenciais."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
import sys
from aebot.runtime import verify_model

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'python/dist/AEBOT-Python-0.1.1'


def main() -> None:
    if OUTPUT.exists():
        raise SystemExit('A pasta de entrega já existe. Preserve-a e use uma nova versão; não sobrescrevo entregas.')
    verify_model(ROOT)
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--onedir', '--windowed',
        '--name', 'AEBOT', '--paths', str(ROOT / 'python'),
        '--distpath', str(ROOT / 'python/build/frozen'), '--workpath', str(ROOT / 'python/build/work'),
        '--specpath', str(ROOT / 'python/build'), str(ROOT / 'python/main.py')], check=True, cwd=ROOT)
    shutil.copytree(ROOT / 'python/build/frozen/AEBOT', OUTPUT)
    resources = OUTPUT / 'resources'
    for relative in ('src/data/rulesStore.json', 'src/data/languageAliases.json', 'schemas/rulesStore.schema.json', 'python/reranker.lock.json'):
        target = resources / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    shutil.copytree(ROOT / 'python/models/bge', resources / 'python/models/bge')
    for name in ('LEIA-ME.txt', 'THIRD-PARTY-NOTICES.md'):
        shutil.copy2(ROOT / 'python' / name, OUTPUT / name)
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
    hashes = []
    for file in sorted(OUTPUT.rglob('*')):
        if file.is_file():
            with file.open('rb') as source:
                digest = hashlib.file_digest(source, 'sha256').hexdigest()
            hashes.append(f'{digest}  {file.relative_to(OUTPUT).as_posix()}')
    (OUTPUT / 'SHA256SUMS.txt').write_text('\n'.join(hashes) + '\n', encoding='utf-8')
    print(json.dumps(dict(directory=str(OUTPUT), files=len(hashes)), ensure_ascii=False))


if __name__ == '__main__':
    main()

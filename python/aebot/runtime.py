"""Carrego arquivos locais verificados; a análise não abre conexão de rede."""
from pathlib import Path
import hashlib
import json
import sys
from .store import RuleStore
from .engine import Engine


def resources_root() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent / 'resources'
    return Path(__file__).resolve().parents[2]


def verify_model(root: Path) -> Path:
    lock = json.loads((root / 'python/reranker.lock.json').read_text(encoding='utf-8'))
    directory = root / 'python/models/bge'
    for relative, expected in lock['files'].items():
        path = directory / relative
        if not path.is_file() or path.stat().st_size != expected['size']:
            raise ValueError('Modelo incompleto. Prepare os arquivos locais antes de abrir o AEBOT.')
        digest = hashlib.sha256() if 'sha256' in expected else hashlib.sha1()
        if 'gitBlob' in expected:
            digest.update(f"blob {expected['size']}\0".encode())
        with path.open('rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
        if digest.hexdigest() != expected.get('sha256', expected.get('gitBlob')):
            raise ValueError('O modelo não passou na verificação de integridade. Baixe novamente pelo preparador.')
    return directory


def load_engine(root: Path | None = None) -> Engine:
    from .reranker import LocalReranker
    root = root or resources_root()
    store = RuleStore(root)
    return Engine(store, LocalReranker(verify_model(root)))

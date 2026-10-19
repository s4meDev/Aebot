"""Baixo somente recursos públicos fixados no lock; nunca recebo conversas."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def digest_file(path: Path, algorithm: str = "sha256", git_blob: bool = False) -> str:
    digest = hashlib.new(algorithm)
    if git_blob:
        digest.update(f"blob {path.stat().st_size}\0".encode())
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare() -> None:
    lock = json.loads((ROOT / 'reranker.lock.json').read_text(encoding="utf-8"))
    destination = ROOT / "models/bge"
    for name, expected in lock["files"].items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            temporary = target.with_suffix(target.suffix + ".partial")
            url = f"https://huggingface.co/{lock['repository']}/resolve/{lock['revision']}/{name}"
            print(f"Preparando {name}...", flush=True)
            with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as output:
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    output.write(chunk)
            # Arquivo incompleto nunca substitui um modelo já validado.
            check(temporary, expected)
            temporary.rename(target)
        check(target, expected)
    print("Modelo local conferido. O aplicativo não precisa de internet para analisar.")


def check(path: Path, expected: dict) -> None:
    if path.stat().st_size != expected["size"]:
        raise ValueError(f"Tamanho incorreto: {path.name}")
    if "sha256" in expected:
        valid = digest_file(path) == expected["sha256"]
    else:
        valid = digest_file(path, "sha1", True) == expected["gitBlob"]
    if not valid:
        raise ValueError(f"Integridade incorreta: {path.name}")


if __name__ == "__main__":
    prepare()

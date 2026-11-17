"""Gero só os arquivos alterados; o manifesto completo é assinado pelo mantenedor."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import zipfile
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from aebot.update_trust import UPDATE_PUBLIC_KEY
from aebot.updates import (RECEIPT, SIGNATURE, digest, installed_version, read_inventory,
    verify_files, signed_release, inspect_update)


def create_update(base: Path | None, target: Path, output: Path, key: Ed25519PrivateKey, *, notes: str) -> dict:
    before, after = read_inventory(base) if base else {}, read_inventory(target)
    if base:
        verify_files(base, before)
    verify_files(target, after)
    files = {name: dict(item, source='base' if before.get(name) == item else 'payload') for name, item in after.items()}
    manifest = dict(schema=1, product='AEBOT-Python', fromVersion=installed_version(base) if base else '0.0.0', toVersion=installed_version(target),
        baseManifestSha256=digest(base / 'SHA256SUMS.txt') if base else '0' * 64, publisher='Pedro Lucas Botelho Naus',
        releasedAt=datetime.now(timezone.utc).isoformat(), notes=notes, minimumLauncher=1, files=files)
    raw = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    signature = key.sign(raw)
    public = key.public_key().public_bytes_raw()
    signed_release(raw, signature, public)
    # Saída exclusiva: nunca sobrescrevo um pacote que já foi distribuído.
    with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, compresslevel=1) as bundle:
        bundle.writestr(RECEIPT, raw)
        bundle.writestr(SIGNATURE, signature)
        for name, item in files.items():
            if item['source'] == 'payload':
                bundle.write(target / name, 'files/' + name)
    inspect_update(output, public)
    with zipfile.ZipFile(output) as bundle:
        if bundle.testzip():
            raise ValueError('O ZIP da atualização falhou na conferência.')
    return dict(fromVersion=manifest['fromVersion'], toVersion=manifest['toVersion'],
        downloadedBytes=output.stat().st_size, localReuseBytes=sum(item['size'] for item in files.values() if item['source'] == 'base'),
        changedFiles=sum(item['source'] == 'payload' for item in files.values()))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-dir', type=Path, help='Omitir somente para gerar primeira instalação completa.')
    parser.add_argument('--to-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--notes', required=True)
    args = parser.parse_args()
    private = Path(__file__).resolve().parents[1] / '.aebot-private/update-signing-key.pem'
    key = serialization.load_pem_private_key(private.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey) or key.public_key().public_bytes_raw() != UPDATE_PUBLIC_KEY:
        raise SystemExit('A chave privada não corresponde à confiança embutida no aplicativo.')
    print(json.dumps(create_update(args.from_dir, args.to_dir, args.output, key, notes=args.notes), ensure_ascii=False))


if __name__ == '__main__':
    main()

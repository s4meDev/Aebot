"""Crio a chave do mantenedor uma vez; nunca a copio para o pacote público."""
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization


def main():
    private = Path(__file__).resolve().parents[1] / '.aebot-private/update-signing-key.pem'
    if private.exists():
        raise SystemExit('A chave já existe. Não gero outra nem sobrescrevo a anterior.')
    private.parent.mkdir(parents=True, exist_ok=True)
    key = Ed25519PrivateKey.generate()
    with private.open('xb') as stream:
        stream.write(key.private_bytes(serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    # Só a chave pública vai para o código e para a saída do preparador.
    print('Chave pública Ed25519:', key.public_key().public_bytes_raw().hex())
    print('Chave privada criada na pasta ignorada .aebot-private. Faça backup seguro; não distribua.')


if __name__ == '__main__':
    main()

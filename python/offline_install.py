"""Instalo o pacote completo já testado, sem rede e sem mudar o Windows."""
from dataclasses import dataclass
from pathlib import Path
import re
from aebot.updates import (UpdateError, check_application, digest, inspect_update,
    install_full, json_object, no_links, relative_path, version)


@dataclass(frozen=True)
class OfflinePayload:
    app_version: str
    filename: str
    sha256: str
    size: int

    @classmethod
    def read(cls, raw: bytes):
        data = json_object(raw)
        if set(data) != {'version', 'filename', 'sha256', 'size'}:
            raise UpdateError('Identificação do instalador inválida.')
        version(data['version'])
        name = relative_path(data['filename'])
        if '/' in name or not name.endswith('.aebot-update'):
            raise UpdateError('Nome do pacote de instalação inválido.')
        if not isinstance(data['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', data['sha256']):
            raise UpdateError('Hash de instalação inválido.')
        if type(data['size']) is not int or not 1 <= data['size'] <= 3 * 1024**3:
            raise UpdateError('Tamanho de instalação inválido.')
        return cls(data['version'], name, data['sha256'], data['size'])


class OfflineSetup:
    def __init__(self, directory: Path, payload: OfflinePayload):
        self.directory, self.payload = directory.absolute(), payload

    def checked_package(self) -> Path:
        package = self.directory / self.payload.filename
        no_links(package)
        if not package.is_file():
            raise UpdateError('Falta o pacote completo. Extraia todo o ZIP e mantenha o .aebot-update ao lado do instalador.')
        if package.stat().st_size != self.payload.size or digest(package) != self.payload.sha256:
            raise UpdateError('O pacote está incompleto ou diferente desta entrega. Copie o ZIP inteiro novamente e extraia em outra pasta.')
        data = inspect_update(package).data
        if data['toVersion'] != self.payload.app_version or data['fromVersion'] != '0.0.0':
            raise UpdateError('O pacote não corresponde à primeira instalação desta versão.')
        return package

    def install(self, destination: Path, *, validator=check_application) -> str:
        if not destination.is_absolute() or str(destination).startswith('\\\\'):
            raise UpdateError('Escolha uma pasta local com caminho completo.')
        no_links(destination)
        if destination.exists():
            raise UpdateError('Já existe uma pasta nesse destino. Não vou sobrescrevê-la. Use o atualizador da instalação existente ou escolha outra pasta nova.')
        # Reconfiro no clique de instalar; uma conferência anterior não autoriza
        # aproveitar outro arquivo que tenha sido trocado depois.
        package = self.checked_package()
        return install_full(destination, package, validator=validator)

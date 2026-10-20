"""Salvo só o formulário enviado. Conversa e métricas não entram no arquivo."""
from contextlib import contextmanager, closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import uuid

CATEGORIES = ('Resposta incorreta', 'Não entendeu o relato', 'Demora', 'Sugestão', 'Outro')
FIELDS = ('id', 'createdAt', 'serviceId', 'serviceName', 'appVersion', 'ruleStoreVersion',
          'category', 'description', 'expectedResponse')
MAX_IMPORT_BYTES = 10 * 1024 * 1024


def default_directory() -> Path:
    local = os.environ.get('LOCALAPPDATA')
    return (Path(local) if local else Path.home() / 'AppData/Local') / 'AEBOT/Python'


def validate_feedback(value: object) -> dict:
    if not isinstance(value, dict) or set(value) != set(FIELDS):
        raise ValueError('Registro de feedback com campos inválidos.')
    for key in FIELDS:
        limit = 6000 if key == 'description' else 4000 if key == 'expectedResponse' else 200
        if not isinstance(value[key], str) or len(value[key]) > limit:
            raise ValueError('O feedback tem texto inválido ou excede o limite.')
        if key != 'expectedResponse' and not value[key].strip():
            raise ValueError('Preencha os campos obrigatórios do feedback.')
    if value['category'] not in CATEGORIES:
        raise ValueError('Categoria de feedback desconhecida.')
    try:
        if str(uuid.UUID(value['id'])) != value['id']:
            raise ValueError()
        instant = datetime.fromisoformat(value['createdAt'])
        if instant.tzinfo is None:
            raise ValueError()
    except (ValueError, TypeError) as error:
        raise ValueError('Identificação ou data do feedback inválida.') from error
    result = {key: value[key] for key in FIELDS}
    result['createdAt'] = instant.astimezone(timezone.utc).isoformat()
    return result


class FeedbackStore:
    def __init__(self, directory: Path | None = None):
        self.path = (directory if directory is not None else default_directory()) / 'feedback.sqlite3'

    @contextmanager
    def connection(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path, timeout=5)) as database, database:
            database.row_factory = sqlite3.Row
            version = database.execute('PRAGMA user_version').fetchone()[0]
            if version not in (0, 1):
                raise ValueError('Esta versão não pode abrir o formato do feedback local.')
            database.execute('CREATE TABLE IF NOT EXISTS feedback (' +
                ', '.join(f'"{key}" TEXT NOT NULL' + (' PRIMARY KEY' if key == 'id' else '') for key in FIELDS) + ')')
            database.execute('CREATE INDEX IF NOT EXISTS feedback_date ON feedback(createdAt)')
            database.execute('PRAGMA user_version = 1')
            yield database

    def save(self, *, service_id, service_name, app_version, base_version,
             category, description, expected_response='') -> dict:
        item = validate_feedback(dict(id=str(uuid.uuid4()), createdAt=datetime.now(timezone.utc).isoformat(),
            serviceId=service_id, serviceName=service_name, appVersion=app_version, ruleStoreVersion=base_version,
            category=category, description=description.strip(), expectedResponse=expected_response.strip()))
        self._merge([item])
        return item

    def _merge(self, items):
        # Valido tudo antes da transação. Uma colisão não salva metade do lote.
        records = [validate_feedback(item) for item in items]
        if len({item['id'] for item in records}) != len(records):
            raise ValueError('O arquivo contém identificações de feedback repetidas.')
        added = 0
        with self.connection() as database:
            for item in records:
                old = database.execute('SELECT * FROM feedback WHERE id = ?', (item['id'],)).fetchone()
                if old:
                    if dict(old) != item:
                        raise ValueError('Há um feedback com o mesmo ID e conteúdo diferente. Nada foi importado.')
                    continue
                database.execute('INSERT INTO feedback VALUES (' + ','.join('?' for _ in FIELDS) + ')',
                    tuple(item[key] for key in FIELDS))
                added += 1
        return added

    def list(self) -> list[dict]:
        if not self.path.exists():
            return []
        with self.connection() as database:
            return [dict(row) for row in database.execute('SELECT * FROM feedback ORDER BY createdAt DESC, id')]

    def export_file(self, destination: Path) -> int:
        if destination.resolve() == self.path.resolve():
            raise ValueError('Escolha um arquivo JSON, não o banco de feedback.')
        items = self.list()
        payload = dict(format='aebot-feedback', version=1, feedback=items)
        content = json.dumps(payload, ensure_ascii=False, indent=2)
        if len(items) > 10000 or len(content.encode('utf-8')) > MAX_IMPORT_BYTES:
            raise ValueError('O lote excede o limite de importação de 10 MB/10.000 registros. O banco local foi preservado; solicite uma exportação fracionada ao mantenedor.')
        # O temporário fica ao lado do destino: substituição atômica, sem
        # deixar um arquivo de exportação parcialmente escrito.
        descriptor, temporary = tempfile.mkstemp(prefix='.aebot-feedback-', suffix='.tmp', dir=destination.parent)
        try:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
                output.write(content)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, destination)
        finally:
            if Path(temporary).exists():
                Path(temporary).unlink()
        return len(items)

    def import_file(self, source: Path) -> int:
        if source.stat().st_size > MAX_IMPORT_BYTES:
            raise ValueError('O arquivo de feedback excede 10 MB. Divida o lote antes de importar.')
        payload = json.loads(source.read_text(encoding='utf-8-sig'))
        if not isinstance(payload, dict) or set(payload) != {'format', 'version', 'feedback'} or \
           payload['format'] != 'aebot-feedback' or type(payload['version']) is not int or payload['version'] != 1:
            raise ValueError('Formato de exportação não reconhecido.')
        if not isinstance(payload['feedback'], list) or len(payload['feedback']) > 10000:
            raise ValueError('Lista de feedback inválida ou muito grande.')
        return self._merge(payload['feedback'])

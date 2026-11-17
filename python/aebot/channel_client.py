"""Isolo a leitura da pasta em processo próprio, com prazo e cancelamento."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
from .company_source import source_candidates, updater_storage
from .updates import (UpdateError, current_directory, digest, installed_version,
    installation_root, json_object, no_links)


class ChannelClient:
    def __init__(self, root: Path, storage: Path | None = None, nearby: Path | None = None):
        self.root = root
        self.storage = storage or updater_storage()
        self.nearby = nearby

    def check(self, cancel: threading.Event | None = None) -> dict:
        installed, manifest = None, None
        if (self.root / 'AEBOT.exe').is_file():
            directory = current_directory(installation_root(self.root))
            installed = installed_version(directory)
            manifest = digest(directory / 'SHA256SUMS.txt')
        sources = source_candidates(self.storage)
        if self.nearby and not (self.storage / 'source.json').exists():
            sources = list(dict.fromkeys([str(self.nearby.absolute())] + sources))[:24]
        result = self._run(dict(operation='check', sources=sources,
            installed=installed, manifest=manifest), cancel, 20)
        result['installed'] = installed
        return result

    def download(self, checked: dict, cancel: threading.Event | None = None) -> Path:
        result = self._run(dict(operation='fetch', source=checked['source'], selection=checked['release']), cancel, 900)
        return Path(result['archive'])

    def _run(self, request, cancel, timeout):
        no_links(self.storage)
        jobs = self.storage / 'jobs'
        jobs.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='job-', dir=jobs) as temporary:
            job = Path(temporary) / 'request.json'
            job.write_text(json.dumps(request), encoding='utf-8')
            command = [sys.executable] if getattr(sys, 'frozen', False) else [sys.executable, str(Path(__file__).resolve().parents[1] / 'updater_main.py')]
            process = subprocess.Popen(command + ['--channel-job', str(job.absolute())],
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            deadline = time.monotonic() + timeout
            try:
                while process.poll() is None:
                    if cancel and cancel.is_set():
                        raise UpdateError('Operação cancelada. A versão instalada foi preservada.')
                    if time.monotonic() > deadline:
                        raise UpdateError('A pasta da empresa não respondeu no prazo. Confira o OneDrive ou a conexão; o app continua funcionando offline.')
                    time.sleep(.1)
                result = Path(temporary) / 'result.json'
                no_links(result)
                if process.returncode != 0 or not result.is_file() or result.stat().st_size > 2 * 1024**2:
                    raise UpdateError('Não consegui conferir a pasta de distribuição.')
                data = json_object(result.read_bytes())
                if not data.get('ok'):
                    raise UpdateError(data.get('error', 'Falha ao ler a distribuição.'))
                return data['result']
            finally:
                if process.poll() is None:
                    # Encerro somente o filho criado por esta operação, nunca
                    # OneDrive, navegador, AEBOT do usuário ou outro processo.
                    process.kill()
                    process.wait(timeout=5)


def execute_job(job: Path):
    from .update_channel import check_sources, fetch_release
    no_links(job)
    if job.name != 'request.json' or not job.parent.name.startswith('job-') or job.parent.parent.name != 'jobs' or job.stat().st_size > 32000:
        raise UpdateError('Operação de distribuição inválida.')
    request = json_object(job.read_bytes())
    try:
        if request.get('operation') == 'check' and set(request) == {'operation', 'sources', 'installed', 'manifest'}:
            if not isinstance(request['sources'], list) or len(request['sources']) > 24 or any(not isinstance(s, str) or len(s) > 1000 for s in request['sources']):
                raise UpdateError('Lista de origens inválida.')
            result = check_sources(request['sources'], request['installed'], request['manifest'])
        elif request.get('operation') == 'fetch' and set(request) == {'operation', 'source', 'selection'}:
            cache = job.parent.parent.parent / 'downloads'
            archive = fetch_release(request['source'], request['selection'], cache)
            result = dict(archive=str(archive.absolute()))
        else:
            raise UpdateError('Operação de distribuição desconhecida.')
        response = dict(ok=True, result=result)
    except Exception as error:
        response = dict(ok=False, error=str(error) if isinstance(error, UpdateError) else
            'Não consegui ler a pasta da empresa. Confira a sincronização e sua permissão de acesso. A instalação não foi alterada.')
    output = job.parent / 'result.json'
    with output.open('x', encoding='utf-8') as stream:
        json.dump(response, stream)

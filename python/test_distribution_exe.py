"""Instalo e atualizo por uma central real de laboratório, sem conta corporativa."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
from cryptography.hazmat.primitives import serialization
from publish_channel import publish
from aebot.channel_client import ChannelClient
from aebot.company_source import save_source
from aebot.updates import apply_update, install_full, current_directory, digest, installed_version, rollback


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--target', type=Path, required=True)
    parser.add_argument('--delta', type=Path, required=True)
    parser.add_argument('--full', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    args = parser.parse_args()
    if args.work.exists():
        raise SystemExit('Preservo relatórios anteriores; use um destino novo.')
    args.work.mkdir()
    report_file = args.work / 'report.json'
    report = dict(status='starting', ok=False)
    def save():
        report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    save()
    try:
        key_file = Path(__file__).resolve().parents[1] / '.aebot-private/update-signing-key.pem'
        key = serialization.load_pem_private_key(key_file.read_bytes(), password=None)
        source = args.work / 'AEBOT'
        publish(source, [args.delta, args.full], key, installer=args.target / 'Abrir-AEBOT.exe')
        storage = args.work / 'settings'
        save_source(storage, str(source.absolute()))
        installed = args.work / 'installed'
        shutil.copytree(args.base, installed)
        original = digest(installed / 'AEBOT.exe')
        client = ChannelClient(installed, storage)
        checked = client.check()
        assert checked['status'] == 'available' and checked['release']['kind'] == 'delta'
        downloaded = client.download(checked)
        number = apply_update(installed, downloaded)
        assert digest(installed / 'AEBOT.exe') == original
        assert client.check()['status'] == 'current'
        # Confiro também a operação em processo filho do EXE congelado, não
        # apenas a versão Python usada pelo script de teste.
        job_dir = storage / 'jobs/job-frozen'
        job_dir.mkdir(parents=True)
        request = dict(operation='check', sources=[str(source.absolute())],
            installed=installed_version(args.base), manifest=digest(args.base / 'SHA256SUMS.txt'))
        (job_dir / 'request.json').write_text(json.dumps(request), encoding='utf-8')
        process = subprocess.run([str((args.target / 'Abrir-AEBOT.exe').resolve()), '--channel-job',
            str((job_dir / 'request.json').resolve())], timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)
        worker = json.loads((job_dir / 'result.json').read_text(encoding='utf-8'))
        assert process.returncode == 0 and worker['ok'] and worker['result']['status'] == 'available'
        fresh = args.work / 'fresh-install'
        installer = ChannelClient(fresh, storage)
        initial = installer.check()
        assert initial['release']['kind'] == 'full'
        complete = installer.download(initial)
        assert install_full(fresh, complete) == number
        assert installer.check()['status'] == 'current'
        report.update(status='completed', ok=True, version=number, initialInstallation=True,
            differentialUpdate=True, frozenChannelWorker=True, originalPreserved=True,
            compatiblePackageChosen=True, restoredVersion=rollback(installed),
            source='pasta local de laboratório; sem acesso corporativo', noRealUserProfile=True)
        assert current_directory(installed) == installed
    except Exception as error:
        report.update(status='failed', exception=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps(report))


if __name__ == '__main__':
    main()

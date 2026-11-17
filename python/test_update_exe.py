"""Testo a migração real em cópia separada, sem tocar na instalação do usuário."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time
from aebot.updates import apply_update, current_directory, digest, rollback


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    args = parser.parse_args()
    if args.work.exists():
        raise SystemExit('Não sobrescrevo teste ou relatório anterior.')
    args.work.mkdir()
    report_path = args.work / 'report.json'
    report = dict(status='starting', ok=False)
    def save():
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    save()
    try:
        installed = args.work / 'installed'
        shutil.copytree(args.base, installed)
        before = digest(installed / 'AEBOT.exe')
        started = time.perf_counter()
        number = apply_update(installed, args.package)
        report['applyMs'] = round((time.perf_counter() - started) * 1000, 2)
        active = current_directory(installed)
        assert active != installed
        assert digest(installed / 'AEBOT.exe') == before
        helper_report = (args.work / 'launcher-check.json').resolve()
        result = subprocess.run([str((installed / 'Abrir-AEBOT.exe').resolve()), '--check', '--root', str(installed.resolve()),
            '--package', str(args.package.resolve()), '--report', str(helper_report)], timeout=60,
            creationflags=subprocess.CREATE_NO_WINDOW)
        assert result.returncode == 0
        helper = json.loads(helper_report.read_text(encoding='utf-8'))
        assert helper['ok'] and helper['signedPackage'] and helper['noModelLoaded']
        previous = rollback(installed)
        assert current_directory(installed) == installed
        assert active.exists()
        assert apply_update(installed, args.package) == number
        assert current_directory(installed) == active
        report.update(status='completed', ok=True, version=number, restoredVersion=previous,
            originalPreserved=True, launcher=helper, reapplicationAfterRollback=True,
            method='Cópia nova da pasta distribuída; atualização assinada, diagnóstico real do EXE, lançador congelado, rollback e reaplicação. Nenhum perfil de usuário foi acessado.')
    except Exception as error:
        report.update(status='failed', exception=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps(report))


if __name__ == '__main__':
    main()

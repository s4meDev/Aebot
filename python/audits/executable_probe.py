"""Meço o processo distribuído em série, sem outra suíte em paralelo."""
from pathlib import Path
import argparse
import json
import statistics
import subprocess
import time
from package_app import OUTPUT

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exe', type=Path, default=OUTPUT / 'AEBOT.exe')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    target = args.output.resolve()
    if target.exists():
        raise SystemExit('Use um destino novo; não sobrescrevo medições anteriores.')
    target.parent.mkdir(parents=True, exist_ok=True)
    report = dict(status='running', executable=str(args.exe),
        method='Três novas instâncias do EXE --check, sem outras suítes em paralelo. Cada uma valida Tk/modelo/base, faz duas análises e testa feedback sintético em SQLite temporário separado. Cache de arquivos do Windows não foi limpo. Não é boot frio nem tempo isolado da primeira resposta.', runs=[])
    def save():
        target.write_text(json.dumps(report, indent=2), encoding='utf-8')
    save()
    try:
        for index in range(3):
            detail = target.parent / (target.stem + f'-detail-{index + 1}.json')
            if detail.exists():
                raise FileExistsError(detail)
            started = time.perf_counter()
            process = subprocess.run([str(args.exe.resolve()), '--check', '--report', str(detail)],
                timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
            record = dict(exitCode=process.returncode, processWallMs=round((time.perf_counter() - started) * 1000, 3),
                report=json.loads(detail.read_text(encoding='utf-8')))
            report['runs'].append(record)
            if process.returncode != 0 or not record['report']['ok']:
                raise RuntimeError('O EXE não passou no diagnóstico.')
            save()
        report['status'] = 'completed'
        report['meanProcessWallMs'] = round(statistics.mean(run['processWallMs'] for run in report['runs']), 3)
    except Exception as error:
        report.update(status='failed', error=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps(report))


if __name__ == '__main__':
    main()

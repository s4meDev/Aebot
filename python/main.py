"""Entrada única do aplicativo e do diagnóstico do pacote distribuído."""
import argparse
import json
import time
from pathlib import Path
import sys
from aebot import __version__


def main() -> None:
    parser = argparse.ArgumentParser(description='AEBOT local em Python')
    parser.add_argument('--check', action='store_true', help='Valida Tk, modelo, regras e uma análise, sem abrir janela.')
    parser.add_argument('--report', type=Path, help='Salva o resultado técnico de --check, sem conversa.')
    args = parser.parse_args()
    if args.check:
        report = dict(ok=False, status='starting', version=__version__)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report), encoding='utf-8')
        try:
            check_runtime(report)
            report['status'] = 'completed'
        except Exception as error:
            report.update(status='failed', technicalException=type(error).__name__)
            raise
        finally:
            if args.report:
                args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
        if sys.stdout is not None:
            print(json.dumps(report))
    else:
        from aebot.app import run
        run()


def check_runtime(report: dict) -> None:
    import tkinter as tk
    from aebot.runtime import load_engine
    started = time.perf_counter()
    window = tk.Tk()
    window.withdraw()
    try:
        engine = load_engine()
        result = engine.evaluate('Sem foto depois.', 'repavimentacao-asfalto-ate-1m2')
        if result.decision != 'Reprovado':
            raise RuntimeError('Falha na verificação básica do pacote.')
        semantic = engine.evaluate('A recomposição ficou visivelmente mal feita.', 'repavimentacao-asfalto-ate-1m2')
        if semantic.decision != 'Reprovado' or not semantic.semanticApplied:
            raise RuntimeError('Falha na interpretação local do pacote.')
        report.update(ok=True, base=engine.store.version, decision=result.decision,
            analysisMs=result.durationMs, semanticMs=semantic.durationMs, semanticCalls=semantic.inferenceCalls,
            startupAndCheckMs=(time.perf_counter() - started) * 1000)
    finally:
        window.destroy()


if __name__ == '__main__':
    main()

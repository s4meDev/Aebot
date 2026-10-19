"""Entrada única do aplicativo e do diagnóstico do pacote distribuído."""
import argparse
import json
import time
from pathlib import Path
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description='AEBOT local em Python')
    parser.add_argument('--check', action='store_true', help='Valida Tk, modelo, regras e uma análise, sem abrir janela.')
    parser.add_argument('--report', type=Path, help='Salva o resultado técnico de --check, sem conversa.')
    args = parser.parse_args()
    if args.check:
        import tkinter as tk
        from aebot.runtime import load_engine
        started = time.perf_counter()
        window = tk.Tk()
        window.withdraw()
        engine = load_engine()
        result = engine.evaluate('Sem foto depois.', 'repavimentacao-asfalto-ate-1m2')
        assert result.decision == 'Reprovado', 'Falha na verificação básica do pacote.'
        semantic = engine.evaluate('Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.', 'repavimentacao-asfalto-ate-1m2')
        assert semantic.decision == 'Reprovado' and semantic.semanticApplied, 'Falha na interpretação local do pacote.'
        window.destroy()
        report = dict(ok=True, base=engine.store.version, decision=result.decision,
            analysisMs=result.durationMs, semanticMs=semantic.durationMs, semanticCalls=semantic.inferenceCalls,
            startupAndCheckMs=(time.perf_counter() - started) * 1000)
        if args.report:
            args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
        if sys.stdout is not None:
            print(json.dumps(report))
    else:
        from aebot.app import run
        run()


if __name__ == '__main__':
    main()

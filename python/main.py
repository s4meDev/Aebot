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
        # O atalho original continua abrindo a versão ativa. --check sempre
        # testa o próprio EXE informado, inclusive durante uma atualização.
        if getattr(sys, 'frozen', False):
            from aebot.updates import installation_root, current_directory
            import subprocess
            try:
                own = Path(sys.executable).resolve().parent
                root = installation_root(own)
                target = current_directory(root)
                if target != own:
                    subprocess.Popen([str(target / 'AEBOT.exe')], creationflags=subprocess.CREATE_NO_WINDOW)
                    return
            except Exception:
                import tkinter as tk
                from tkinter import messagebox
                window = tk.Tk()
                window.withdraw()
                messagebox.showerror('Versão ativa não conferida', 'Abra Abrir-AEBOT.exe para verificar ou voltar à versão anterior. Não vou abrir silenciosamente uma versão diferente.', parent=window)
                window.destroy()
                return
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
        check_feedback(window, engine)
        check_interface(window, engine)
        report.update(ok=True, base=engine.store.version, decision=result.decision,
            feedbackCheck=True, interfaceCheck=True, profileServices=len(engine.store.services),
            analysisMs=result.durationMs, semanticMs=semantic.durationMs, semanticCalls=semantic.inferenceCalls,
            startupAndCheckMs=(time.perf_counter() - started) * 1000)
    finally:
        window.destroy()


def check_interface(window, engine):
    """Confiro o layout e os recursos que realmente entraram no EXE."""
    import tempfile
    from aebot.app import App
    if getattr(sys, 'frozen', False) and not (Path(sys.executable).parent / 'Abrir-AEBOT.exe').is_file():
        raise RuntimeError('O lançador/atualizador não veio na pasta completa.')
    with tempfile.TemporaryDirectory(prefix='aebot-interface-check-') as directory:
        app = App(window, feedback_directory=Path(directory), engine_loader=lambda: engine)
        limit = time.monotonic() + 3
        while app.busy and time.monotonic() < limit:
            window.update()
            time.sleep(.01)
        if app.busy or app.session is None or app.logo is None:
            raise RuntimeError('A interface, a logo ou o perfil não veio completo no pacote.')
        if app.input.winfo_manager() != 'grid' or tuple(app.store.services) != tuple(engine.store.services):
            raise RuntimeError('O layout e a análise não estão usando o mesmo perfil.')
        if app.progress.winfo_manager():
            raise RuntimeError('A interface não pode parecer carregando depois de pronta.')
        app.latest_result = engine.evaluate('Sem foto depois.', next(iter(engine.store.services)))
        reader = app.open_evidence()
        if reader is None or any(item.id not in reader.details.get('1.0', 'end') for item in app.latest_result.matchedRules):
            raise RuntimeError('Os fundamentos completos não vieram no pacote.')
        app.new_case()
        if reader.window.winfo_exists() or app.latest_result is not None:
            raise RuntimeError('Novo caso deixou fundamentos antigos como se fossem atuais.')
        service_id = next(iter(engine.store.services))
        app.session.ask('Se faltar aferição da vala?', service_id)
        query = 'E qual é a regra da foto depois?'
        consultation = app.session.ask(query, service_id)
        if consultation.intent != 'question' or consultation.pendingInformation or any(
                item.sourceQuote not in query for item in consultation.matchedRules):
            raise RuntimeError('A consulta intermediária foi misturada com a hipótese.')
        scenario = app.session.ask('interna', service_id)
        if scenario.decision is not None or scenario.scenarioDecision != 'Não Conforme' or scenario.pendingInformation:
            raise RuntimeError('A hipótese não retomou seu próprio esclarecimento.')
        app.new_case()
        absent = engine.evaluate('Não está sem foto depois.', service_id)
        if absent.decision is not None or absent.outcome != 'advisory':
            raise RuntimeError('Uma negação de falta virou irregularidade.')
        ambiguous = app.session.ask('Sem aferição da vala. Equipe interna ou terceirizada.', service_id)
        if ambiguous.decision is not None or not ambiguous.pendingInformation:
            raise RuntimeError('Uma alternativa foi tratada como equipe confirmada.')
        clarified = app.session.ask('interna', service_id)
        if clarified.decision != 'Não Conforme':
            raise RuntimeError('A pergunta de equipe não foi resolvida pelo contexto informado.')
        uncertain = app.session.ask('Corrigindo: não tenho certeza se é interna.', service_id)
        if uncertain.decision is not None or not uncertain.pendingInformation:
            raise RuntimeError('A retirada da certeza manteve o vínculo antigo.')
        confirmed = app.session.ask('terceirizada', service_id)
        if confirmed.decision != 'Reprovado' or confirmed.pendingInformation:
            raise RuntimeError('O novo esclarecimento não resolveu a equipe pendente.')
        app.new_case()
        if app.feedback_store.path.exists():
            raise RuntimeError('O diagnóstico não pode criar feedback automaticamente.')


def check_feedback(window, engine) -> None:
    """Confiro também SQLite e telas no EXE, sem tocar no feedback do usuário."""
    import tempfile
    from aebot.feedback import FeedbackStore
    from aebot.feedback_ui import FeedbackDialog, FeedbackReader
    with tempfile.TemporaryDirectory(prefix='aebot-diagnostic-') as directory:
        store = FeedbackStore(Path(directory))
        service_id = 'repavimentacao-asfalto-ate-1m2'
        form = FeedbackDialog(window, store, dict(service_id=service_id,
            service_name=engine.store.services[service_id]['name'], app_version=__version__, base_version=engine.store.version))
        form.window.withdraw()
        try:
            if form.description.get('1.0', 'end-1c') or form.expected.get('1.0', 'end-1c') or store.path.exists():
                raise RuntimeError('O formulário precisa começar vazio e sem persistência.')
        finally:
            form.window.destroy()
        store.save(service_id=service_id, service_name=engine.store.services[service_id]['name'],
            app_version=__version__, base_version=engine.store.version, category='Sugestão',
            description='Teste técnico de feedback; nenhum conteúdo de análise.')
        reader = FeedbackReader(window, store)
        reader.window.withdraw()
        try:
            if len(reader.tree.get_children()) != 1:
                raise RuntimeError('Falha ao ler o feedback de teste no pacote.')
        finally:
            reader.window.destroy()


if __name__ == '__main__':
    main()

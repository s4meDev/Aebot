"""Testo a janela com a IA real, sem automação do computador do usuário."""
import json
import argparse
import time
import tkinter as tk
from pathlib import Path
import tempfile
from unittest.mock import patch
from aebot.app import App


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    window = tk.Tk()
    artifacts = Path(__file__).resolve().parent / 'artifacts'
    artifacts.mkdir(exist_ok=True)
    temporary = tempfile.TemporaryDirectory(dir=artifacts)
    app = App(window, feedback_directory=Path(temporary.name) / 'local-feedback')
    def settle(target=None) -> None:
        target = target or app
        limit = time.monotonic() + 30
        while target.busy and time.monotonic() < limit:
            target.window.update()
            time.sleep(0.01)
        target.window.update()
        assert not target.busy, 'A janela não recebeu a resposta em 30s.'
    def capture(name):
        if args.screenshots:
            from PIL import ImageGrab
            args.screenshots.mkdir(parents=True, exist_ok=True)
            window.attributes('-topmost', True)
            window.lift()
            window.update()
            time.sleep(.25)
            window.update()
            assert window.winfo_viewable(), 'A captura deve mostrar a janela de teste, não o desktop.'
            box = (window.winfo_rootx(), window.winfo_rooty(), window.winfo_rootx() + window.winfo_width(), window.winfo_rooty() + window.winfo_height())
            ImageGrab.grab(bbox=box).save(args.screenshots / name)
            window.attributes('-topmost', False)
    try:
        settle()
        assert app.session is not None, app.status.get()
        assert app.logo is not None, 'A identidade visual precisa estar no código e no pacote.'
        for size in ('580x500', '1024x650', '1280x720'):
            window.geometry(size + '+20+20')
            window.update()
            for widget in (app.input, app.chat, app.send_button, app.reset_button, app.update_button):
                assert widget.winfo_ismapped() and widget.winfo_height() > 12, (size, widget)
                bottom = widget.winfo_rooty() + widget.winfo_height()
                assert bottom <= window.winfo_rooty() + window.winfo_height(), (size, 'controle fora da janela')
        rules = app.open_rules()
        rules.search.set('VCG')
        window.update()
        assert rules.tree.exists('RULE-ASF-ORIGEM-VCG-01')
        rules.tree.selection_set('RULE-ASF-ORIGEM-VCG-01')
        rules.selected()
        assert 'não aprova automaticamente' in rules.details.get('1.0', 'end')
        rules.window.destroy()
        for text, expected in [('A trena impede verificar a metragem.', None), ('interna', 'Não Conforme')]:
            app.input.insert('1.0', text)
            app.send()
            settle()
            assert app.session.last.decision == expected
        assert 'retrabalho' in app.chat.get('1.0', 'end').lower()
        assert app.result_badge.cget('text') == 'Não Conforme'
        assert app.evidence_button.cget('state') == 'normal'
        assert 'Base:' not in app.chat.get('1.0', 'end'), 'O chat curto deixa as referências na tela de fundamentos.'
        evidence = app.open_evidence()
        evidence.window.geometry('540x400')
        window.update()
        for match in app.latest_result.matchedRules:
            assert match.id in evidence.details.get('1.0', 'end')
            assert match.sourceQuote in evidence.details.get('1.0', 'end')
        app.new_case()
        assert not evidence.window.winfo_exists(), 'Novo caso não deixa fundamentos antigos abertos como se fossem atuais.'
        assert app.latest_result is None
        assert app.evidence_button.cget('state') == 'disabled'
        assert app.result_badge.cget('text') == 'Consulta local'
        assert 'Novo caso' in app.status.get()
        for text, expected in [('Sem foto antes. Não registraram uma coisa que não sei explicar.', None),
                               ('Quis dizer: sem foto durante.', 'Reprovado')]:
            app.input.insert('1.0', text)
            app.send()
            settle()
            assert app.session.last.decision == expected
        assert app.session.ignored_sources, 'O ponto ambíguo precisa ter sido substituído, não ignorado por acaso.'
        app.new_case()
        assert app.session.last is None
        app.service.current(1)
        app.input.insert('1.0', 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.')
        app.send()
        settle()
        assert app.session.last.decision == 'Reprovado'
        assert app.session.last.serviceId.endswith('acima-1m2')
        app.new_case()
        for text, expected in [('Sem aferição da vala. A equipe é interna ou terceirizada.', None),
                               ('interna', 'Não Conforme')]:
            app.input.insert('1.0', text)
            app.send()
            settle()
            assert app.session.last.decision == expected
        app.new_case()
        app.input.insert('1.0', 'Não está sem foto depois.')
        app.send()
        settle()
        assert app.session.last.decision is None
        assert 'não está descrito como uma falha' in app.chat.get('1.0', 'end')
        evidence = app.open_evidence()
        assert 'PONTOS QUE NÃO CONFIRMARAM UMA FALHA' in evidence.details.get('1.0', 'end')
        assert 'Não está sem foto depois' in evidence.details.get('1.0', 'end')
        app.new_case()
        for text, expected in [('Sem aferição da vala. Equipe interna e terceirizada.', None),
                               ('Acho que é interna.', None), ('interna', 'Não Conforme'),
                               ('Corrigindo: não tenho certeza se é interna.', None),
                               ('terceirizada', 'Reprovado')]:
            app.input.insert('1.0', text)
            app.send()
            settle()
            assert app.session.last.decision == expected, text
            if expected is None:
                assert app.result_badge.cget('text') == 'Falta confirmar'
                assert app.session.last.pendingInformation
        # Uma consulta no meio da hipótese não é resposta sobre a equipe.
        app.new_case()
        for text in ('Sem foto antes.', 'Mas se faltar aferição da vala?', 'E qual é a regra da foto depois?'):
            app.input.insert('1.0', text)
            app.send()
            settle()
        assert app.session.last.intent == 'question'
        assert app.session.last.primaryRule == 'RULE-ASF-FOTO-DEPOIS-01'
        assert 'ainda aguarda' in app.status.get()
        assert 'consulta · não altera a OS' in app.chat.get('1.0', 'end')
        app.input.insert('1.0', 'interna')
        app.send()
        settle()
        assert app.session.last.intent == 'hypothesis'
        assert app.session.last.decision is None and not app.session.last.pendingInformation
        assert 'aferição' not in app.session.query
        # Uma falha no próximo turno não pode mostrar os fundamentos antigos.
        evidence = app.open_evidence()
        with patch.object(app.session, 'ask', side_effect=RuntimeError('falha sintética')):
            app.input.insert('1.0', 'E formulário preenchido incorretamente.')
            app.send()
            settle()
        assert not evidence.window.winfo_exists()
        assert app.latest_result is None
        assert app.evidence_button.cget('state') == 'disabled'
        assert app.open_evidence() is None
        assert 'Falha local' in app.status.get()
        assert app.input.get('1.0', 'end').strip() == 'E formulário preenchido incorretamente.'
        assert 'Turno não concluído' == app.overview.title.cget('text')
        app.new_case()
        window.geometry('1180x740+20+20')
        window.update()
        assert app.sidebar_visible and app.overview.frame.winfo_ismapped()
        app.input.insert('1.0', 'Sem aferição da vala.')
        app.send()
        settle()
        assert len(app.context_prompt.controls) == 2
        assert app.context_prompt.frame.winfo_ismapped()
        capture('contexto-pendente.png')
        # O clique inclui o rascunho, em vez de apagar outra ocorrência.
        app.input.insert('1.0', 'E formulário preenchido incorretamente')
        app.context_prompt.controls[0].invoke()
        assert app.input.cget('state') == 'normal' and app.busy
        app.input.insert('1.0', 'Rascunho da próxima pergunta, ainda não enviado.')
        settle()
        assert app.session.last.decision == 'Não Conforme'
        assert 'RULE-ASF-FORMULARIO-01' in {item.id for item in app.session.last.matchedRules}
        assert app.input.get('1.0', 'end').strip() == 'Rascunho da próxima pergunta, ainda não enviado.'
        assert not app.context_prompt.frame.winfo_ismapped()
        with patch.object(window, 'clipboard_clear'), patch.object(window, 'clipboard_append') as copy:
            app.copy_button.invoke()
        assert 'RULE-ASF-FORMULARIO-01' in copy.call_args.args[0]
        previous = app.session.case_last
        with patch('aebot.app.messagebox.askyesno', return_value=False):
            app.reset_button.invoke()
        assert app.session.case_last is previous
        capture('analise-com-resumo.png')
        app.new_case()
        assert app.store.text.normalize.cache_info().currsize == 0, 'Novo caso também limpa o cache de texto da interface.'
        app.input.insert('1.0', 'Sem aferição da vala.')
        app.send()
        settle()
        app.input.insert('1.0', 'Se faltar foto depois?')
        app.context_prompt.controls[0].invoke()
        settle()
        assert app.session.case_last.decision == 'Não Conforme'
        assert app.input.get('1.0', 'end').strip() == 'Se faltar foto depois?'
        assert not app.session.scenario, 'Confirmar equipe não envia a hipótese do rascunho.'
        old_draft = 'Se faltar foto depois?'
        app.input.delete('1.0', 'end')
        app.input.insert('1.0', 'Novo caso: formulário preenchido incorretamente.')
        app.send()
        settle()
        misses = app.session.engine.text.normalize.cache_info().misses
        app.session.engine.text.normalize(old_draft)
        assert app.session.engine.text.normalize.cache_info().misses == misses + 1, 'Novo caso escrito também descarta o cache do rascunho anterior.'
        app.new_case()
        app.input.insert('1.0', 'Sem aferição na OS de origem.')
        app.send()
        settle()
        assert len(app.context_prompt.controls) == 2
        assert app.context_prompt.controls[0].current() == -1
        app.context_prompt.controls[1].invoke()
        assert app.session.pending and not app.busy, 'Responder sem escolher não confirma contexto.'
        window.geometry('580x500+20+20')
        window.update()
        assert not app.sidebar_visible
        for widget in [app.input, app.send_button, *app.context_prompt.controls]:
            assert widget.winfo_rootx() + widget.winfo_width() <= window.winfo_rootx() + window.winfo_width()
            assert widget.winfo_rooty() + widget.winfo_height() <= window.winfo_rooty() + window.winfo_height()
        capture('janela-compacta.png')
        app.new_case()
        assert not app.feedback_store.path.exists(), 'Analisar uma OS não pode gravar feedback ou métricas.'
        form = app.open_feedback()
        form.window.geometry('540x500')
        window.update()
        assert form.save_button.winfo_rooty() + form.save_button.winfo_height() <= form.window.winfo_rooty() + form.window.winfo_height()
        assert form.description.get('1.0', 'end-1c') == ''
        assert form.expected.get('1.0', 'end-1c') == ''
        form.description.insert('1.0', 'Relato de teste escrito voluntariamente no formulário.')
        form.expected.insert('1.0', 'Orientação esperada de teste.')
        with patch('aebot.feedback_ui.messagebox.showinfo'):
            form.save()
        assert len(app.feedback_store.list()) == 1
        reader = app.open_feedback_reader()
        reader.window.geometry('660x540')
        window.update()
        assert reader.export_button.winfo_rooty() + reader.export_button.winfo_height() <= reader.window.winfo_rooty() + reader.window.winfo_height()
        assert len(reader.tree.get_children()) == 1
        reader.tree.selection_set(reader.tree.get_children()[0])
        reader.selected()
        assert 'voluntariamente' in reader.details.get('1.0', 'end')
        assert 'Não enviaram nenhuma imagem' not in reader.details.get('1.0', 'end')
        reader.window.destroy()
        # Uma falha de inicialização precisa permitir nova tentativa. O teste
        # injeta a falha, mas reutiliza o mesmo motor real ao tentar de novo.
        attempts = []
        def recoverable_loader():
            attempts.append(True)
            if len(attempts) == 1:
                raise ValueError('falha sintética, sem conteúdo do analista')
            return app.session.engine
        retry_window = tk.Toplevel(window)
        retry_app = App(retry_window, feedback_directory=Path(temporary.name) / 'retry-feedback', engine_loader=recoverable_loader)
        settle(retry_app)
        retry_window.geometry('580x500')
        retry_window.update()
        assert retry_app.session is None
        assert retry_app.retry_button.winfo_ismapped()
        assert retry_app.retry_button.winfo_rootx() + retry_app.retry_button.winfo_width() <= retry_window.winfo_rootx() + retry_window.winfo_width()
        assert retry_app.send_button.cget('state') == 'disabled'
        retry_app.retry_load()
        settle(retry_app)
        assert len(attempts) == 2 and retry_app.session is not None
        assert not retry_app.retry_button.winfo_ismapped()
        assert retry_app.send_button.cget('state') == 'normal'
        assert not retry_app.feedback_store.path.exists()
        retry_window.destroy()
        print(json.dumps(dict(ok=True, interface='Tkinter', checked=['modelo real', 'pergunta e resposta curta',
            'novo caso', 'segundo serviço', 'paráfrase real', 'thread da interface',
            'feedback voluntário sem chat', 'leitura de feedback', 'análise sem persistência',
            'campo de envio em três tamanhos', 'logo embarcada', 'consulta às exceções', 'botão de feedback visível',
            'esclarecimento substitui só o trecho ambíguo', 'trena pergunta vínculo e interna gera retrabalho',
            'fundamentos completos sem alongar o chat', 'estado visual limpo em Novo caso',
            'recuperação após falha de inicialização', 'consulta não responde hipótese pendente',
            'falha no turno não reutiliza fundamentos antigos', 'alternativa não confirma equipe',
            'negação de falta com fundamento não classificatório',
            'vínculos conflitantes e certeza retirada com esclarecimento posterior',
            'resumo lateral responsivo', 'escolha explícita do contexto cadastrado',
            'rascunho durante análise e restauração após erro', 'copiar resposta com referências',
            'novo caso confirma descarte do rascunho', 'pergunta de frente sem escolha automática'])))
    finally:
        window.destroy()
        temporary.cleanup()


if __name__ == '__main__':
    main()

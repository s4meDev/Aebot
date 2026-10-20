"""Testo a janela com a IA real, sem automação do computador do usuário."""
import json
import time
import tkinter as tk
from pathlib import Path
import tempfile
from unittest.mock import patch
from aebot.app import App


def main() -> None:
    window = tk.Tk()
    artifacts = Path(__file__).resolve().parent / 'artifacts'
    artifacts.mkdir(exist_ok=True)
    temporary = tempfile.TemporaryDirectory(dir=artifacts)
    app = App(window, feedback_directory=Path(temporary.name) / 'local-feedback')
    def settle() -> None:
        limit = time.monotonic() + 30
        while app.busy and time.monotonic() < limit:
            window.update()
            time.sleep(0.01)
        window.update()
        assert not app.busy, 'A janela não recebeu a resposta em 30s.'
    try:
        settle()
        assert app.session is not None, app.status.get()
        for text, expected in [('Sem aferição da vala.', None), ('interna', 'Não Conforme')]:
            app.input.insert('1.0', text)
            app.send()
            settle()
            assert app.session.last.decision == expected
        assert 'retrabalho' in app.chat.get('1.0', 'end').lower()
        app.new_case()
        assert app.session.last is None
        app.service.current(1)
        app.input.insert('1.0', 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.')
        app.send()
        settle()
        assert app.session.last.decision == 'Reprovado'
        assert app.session.last.serviceId.endswith('acima-1m2')
        assert not app.feedback_store.path.exists(), 'Analisar uma OS não pode gravar feedback ou métricas.'
        form = app.open_feedback()
        assert form.description.get('1.0', 'end-1c') == ''
        assert form.expected.get('1.0', 'end-1c') == ''
        form.description.insert('1.0', 'Relato de teste escrito voluntariamente no formulário.')
        form.expected.insert('1.0', 'Orientação esperada de teste.')
        with patch('aebot.feedback_ui.messagebox.showinfo'):
            form.save()
        assert len(app.feedback_store.list()) == 1
        reader = app.open_feedback_reader()
        assert len(reader.tree.get_children()) == 1
        reader.tree.selection_set(reader.tree.get_children()[0])
        reader.selected()
        assert 'voluntariamente' in reader.details.get('1.0', 'end')
        assert 'Não enviaram nenhuma imagem' not in reader.details.get('1.0', 'end')
        reader.window.destroy()
        print(json.dumps(dict(ok=True, interface='Tkinter', checked=['modelo real', 'pergunta e resposta curta',
            'novo caso', 'segundo serviço', 'paráfrase real', 'thread da interface',
            'feedback voluntário sem chat', 'leitura de feedback', 'análise sem persistência'])))
    finally:
        window.destroy()
        temporary.cleanup()


if __name__ == '__main__':
    main()

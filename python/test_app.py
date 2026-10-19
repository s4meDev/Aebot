"""Testo a janela com a IA real, sem automação do computador do usuário."""
import json
import time
import tkinter as tk
from aebot.app import App


def main() -> None:
    window = tk.Tk()
    app = App(window)
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
        print(json.dumps(dict(ok=True, interface='Tkinter', checked=['modelo real', 'pergunta e resposta curta',
            'novo caso', 'segundo serviço', 'paráfrase real', 'thread da interface'])))
    finally:
        window.destroy()


if __name__ == '__main__':
    main()

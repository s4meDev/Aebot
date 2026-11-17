"""Confiro a tela e a espera do instalador, sem escrever no perfil real."""
import json
from pathlib import Path
import threading
import time
import tkinter as tk
from types import SimpleNamespace
from unittest.mock import patch
from offline_setup import InstallWindow


def main():
    window = tk.Tk()
    release = threading.Event()
    calls = []
    def install(destination):
        calls.append(destination)
        if not release.wait(3):
            raise RuntimeError('Teste não liberou a operação.')
        return '0.9.1'
    setup = SimpleNamespace(payload=SimpleNamespace(app_version='0.9.1'), install=install)
    panel = InstallWindow(window, setup, destination=Path.cwd() / 'python/artifacts/unused-ui-target')
    try:
        for size in ('580x500', '660x530', '950x700'):
            window.geometry(size + '+20000+20000')
            window.update()
            for widget in (panel.install_button, panel.open_button, panel.folder_button, panel.choose_button):
                assert widget.winfo_ismapped()
                assert widget.winfo_rooty() + widget.winfo_height() <= window.winfo_rooty() + window.winfo_height()
                assert widget.winfo_rootx() + widget.winfo_width() <= window.winfo_rootx() + window.winfo_width()
        assert panel.open_button.cget('state') == 'disabled'
        panel.install()
        panel.install()
        assert panel.busy and panel.install_button.cget('state') == 'disabled'
        with patch('offline_setup.messagebox.showinfo') as notice:
            panel.close()
            notice.assert_called_once()
        assert window.winfo_exists()
        release.set()
        deadline = time.monotonic() + 5
        while panel.busy and time.monotonic() < deadline:
            window.update()
            time.sleep(.01)
        assert panel.complete and len(calls) == 1
        assert panel.open_button.cget('state') == 'normal'
        assert panel.folder_button.cget('state') == 'normal'
        assert panel.choose_button.cget('state') == 'disabled'
        assert 'instalado e testado' in panel.status.get()
        # Falha precisa permitir tentar novamente e nunca anunciar conclusão.
        panel.complete = False
        panel.events.put((False, 'Falha sintética; instalação anterior preservada.'))
        panel.poll()
        assert not panel.complete and panel.install_button.cget('state') == 'normal'
        assert panel.choose_button.cget('state') == 'normal'
        print(json.dumps(dict(ok=True, sizes=3, explicitInstall=True, singleOperation=True,
            responsiveWorker=True, failureRetry=True, noRealUserProfile=True)))
    finally:
        release.set()
        window.destroy()


if __name__ == '__main__':
    main()

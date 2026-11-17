"""Tela de primeira instalação offline. A IA só abre depois da conferência."""
import argparse
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from aebot.company_source import default_install_directory
from aebot.theme import BG, BLUE, FG, MUTED, button, configure_theme
from aebot.updates import UpdateError, launch_application
from offline_install import OfflinePayload, OfflineSetup


class InstallWindow:
    def __init__(self, window, setup, destination=None):
        self.window, self.setup = window, setup
        self.destination = Path(destination or default_install_directory())
        self.events, self.busy, self.complete = queue.Queue(), False, False
        configure_theme(window)
        window.title('Instalar AEBOT • Asfalto')
        window.geometry('660x530')
        window.minsize(580, 500)
        window.configure(bg=BG)
        frame = tk.Frame(window, bg=BG, padx=26, pady=22)
        frame.pack(fill='both', expand=True)
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(3, weight=1)
        tk.Label(frame, text='AEBOT', bg=BG, fg=BLUE, font=('Segoe UI', 25, 'bold')).grid(row=0, column=0, sticky='w')
        tk.Label(frame, text='Repavimentação Asfalto · ' + setup.payload.app_version,
            bg=BG, fg=MUTED, font=('Segoe UI', 11)).grid(row=1, column=0, sticky='w', pady=(0, 16))
        tk.Label(frame, text='Instalação offline no seu usuário\nNão precisa de Python, chave de IA ou servidor.',
            bg=BG, fg=FG, justify='left', font=('Segoe UI', 11)).grid(row=2, column=0, sticky='w')
        self.status = tk.StringVar(value='Clique em Instalar. Vou conferir os arquivos e testar o aplicativo antes de concluir. Não feche esta janela durante a instalação.')
        self.detail = tk.Label(frame, textvariable=self.status, wraplength=580, bg=BG,
            fg=FG, justify='left', anchor='w', font=('Segoe UI', 11))
        self.detail.grid(row=3, column=0, sticky='nsew', pady=14)
        self.path_label = tk.Label(frame, text=str(self.destination), bg=BG, fg=MUTED,
            wraplength=580, justify='left', font=('Segoe UI', 9))
        self.path_label.grid(row=4, column=0, sticky='ew')
        self.progress = ttk.Progressbar(frame, mode='indeterminate')
        self.progress.grid(row=5, column=0, sticky='ew', pady=12)
        actions = tk.Frame(frame, bg=BG)
        actions.grid(row=6, column=0, sticky='ew')
        actions.columnconfigure((0, 1), weight=1)
        self.install_button = button(actions, 'Instalar AEBOT', self.install, primary=True)
        self.open_button = button(actions, 'Abrir AEBOT', self.open_app)
        self.folder_button = button(actions, 'Abrir pasta instalada', self.open_folder)
        self.choose_button = button(actions, 'Escolher outra pasta', self.choose)
        for widget, row, col in [(self.install_button, 0, 0), (self.open_button, 0, 1),
                                 (self.choose_button, 1, 0), (self.folder_button, 1, 1)]:
            widget.grid(row=row, column=col, sticky='ew', padx=3, pady=3)
        self.open_button.configure(state='disabled')
        self.folder_button.configure(state='disabled')
        tk.Label(frame, text='Teste assistido por regras. Não lê fotos. A decisão no sistema continua com o analista.\nO AEBOT ainda não tem certificado próprio de EXE; não altere proteções do Windows.',
            bg=BG, fg=MUTED, justify='left', wraplength=580, font=('Segoe UI', 9)).grid(row=7, column=0, sticky='ew', pady=(14, 0))
        frame.bind('<Configure>', lambda e: self.resize(e.width))
        window.protocol('WM_DELETE_WINDOW', self.close)
        window.after(80, self.poll)

    def resize(self, width):
        self.detail.configure(wraplength=max(300, width - 56))
        self.path_label.configure(wraplength=max(300, width - 56))

    def choose(self):
        if self.busy or self.complete:
            return
        parent = filedialog.askdirectory(title='Escolha a pasta que receberá uma nova pasta AEBOT', parent=self.window)
        if parent:
            self.destination = Path(parent) / 'AEBOT'
            self.path_label.configure(text=str(self.destination))

    def install(self):
        if self.busy or self.complete:
            return
        self.busy = True
        self.install_button.configure(state='disabled')
        self.choose_button.configure(state='disabled')
        self.status.set('Conferindo o pacote e instalando… O teste local da IA pode levar mais tempo na primeira abertura. Aguarde; nenhum arquivo será baixado.')
        self.progress.start(16)
        destination = self.destination
        def execute():
            try:
                self.events.put((True, self.setup.install(destination)))
            except Exception as error:
                text = str(error) if isinstance(error, (UpdateError, PermissionError)) else 'Não consegui concluir a instalação. Confira o espaço livre, a extração completa e a mensagem do Windows. Nenhuma instalação anterior foi substituída.'
                self.events.put((False, text))
        threading.Thread(target=execute, daemon=True).start()

    def poll(self):
        try:
            ok, result = self.events.get_nowait()
            self.busy = False
            self.progress.stop()
            self.complete = ok
            if ok:
                self.status.set('AEBOT ' + result + ' instalado e testado. Clique em Abrir AEBOT. Para usar depois, abra Abrir-AEBOT.exe na pasta instalada ou crie um atalho dele.')
                self.open_button.configure(state='normal')
                self.folder_button.configure(state='normal')
            else:
                self.open_button.configure(state='disabled')
                self.folder_button.configure(state='disabled')
                self.status.set(result)
                self.install_button.configure(state='normal')
                self.choose_button.configure(state='normal')
        except queue.Empty:
            pass
        self.window.after(80, self.poll)

    def open_app(self):
        if not self.complete:
            return
        try:
            launch_application(self.destination)
            self.window.destroy()
        except Exception:
            messagebox.showerror('AEBOT não iniciado', 'A instalação foi preservada. Abra a pasta instalada e confira a mensagem do Windows.', parent=self.window)

    def open_folder(self):
        if self.complete and os.name == 'nt':
            subprocess.Popen(['explorer.exe', str(self.destination)], creationflags=subprocess.CREATE_NO_WINDOW)

    def close(self):
        if self.busy:
            messagebox.showinfo('Instalação em andamento', 'Aguarde a conferência e o teste terminarem. A janela continua respondendo.', parent=self.window)
        else:
            self.window.destroy()


def main():
    parser = argparse.ArgumentParser(description='Primeira instalação offline do AEBOT')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--root', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    metadata = Path(getattr(sys, '_MEIPASS', Path(__file__).parent)) / 'offline-payload.json'
    own = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path.cwd()
    if args.check:
        if not args.root or not args.report or not args.report.is_absolute() or args.report.exists():
            raise SystemExit('O diagnóstico exige --root e --report novo e absoluto. Não usa o perfil real.')
        report = dict(status='starting', ok=False, noRealUserProfile=True)
        args.report.write_text(json.dumps(report), encoding='utf-8')
        try:
            setup = OfflineSetup(own, OfflinePayload.read(metadata.read_bytes()))
            window = tk.Tk()
            window.withdraw()
            try:
                panel = InstallWindow(window, setup, args.root)
                window.update()
                if panel.open_button.cget('state') != 'disabled' or panel.busy:
                    raise RuntimeError('O instalador não pode abrir uma instalação ainda não conferida.')
                report['installerInterfaceChecked'] = True
            finally:
                window.destroy()
            installed = setup.install(args.root)
            report.update(status='completed', ok=True, version=installed, installedExeChecked=True)
        except Exception as error:
            report.update(status='failed', exception=type(error).__name__)
            raise
        finally:
            args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
        return
    window = tk.Tk()
    try:
        setup = OfflineSetup(own, OfflinePayload.read(metadata.read_bytes()))
        InstallWindow(window, setup, args.root)
    except Exception:
        window.withdraw()
        messagebox.showerror('Instalador incompleto', 'Copie novamente a entrega completa do AEBOT e extraia todo o ZIP. Não é necessário instalar Python nem alterar a segurança do Windows.', parent=window)
        window.destroy()
        return
    window.mainloop()


if __name__ == '__main__':
    main()

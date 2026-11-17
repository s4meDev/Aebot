"""Procuro na pasta da empresa e só instalo depois do clique do analista."""
from pathlib import Path
import queue
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from .theme import BG, SURFACE, FG, MUTED, BLUE, configure_theme, button
from .company_source import default_install_directory, updater_storage, save_source
from .channel_client import ChannelClient
from .updates import (UpdateError, apply_update, install_full, rollback, inspect_update, launch_application)


class ChannelWindow:
    def __init__(self, window, initial_root=None, download_directory=None, *, storage=None, auto_check=False):
        self.window, self.busy = window, False
        self.events = queue.Queue()
        self.cancel = threading.Event()
        self.storage = storage or updater_storage()
        self.root = tk.StringVar(value=str(initial_root or default_install_directory()))
        self.package = tk.StringVar()
        self.selection = None
        self.manual_archive = None
        self.phase = ''
        self.status = tk.StringVar(value='Procure a versão publicada na pasta da empresa. A análise continua offline.')
        self.source = tk.StringVar(value='Detectar biblioteca da empresa pelo OneDrive')
        directory = download_directory or Path.cwd()
        self.nearby = directory
        matches = list(directory.glob('*.aebot-update'))
        if len(matches) == 1:
            self.package.set(str(matches[0]))
        configure_theme(window)
        window.title('Atualizações do AEBOT')
        window.geometry('720x560')
        window.minsize(560, 480)
        window.configure(bg=BG)
        frame = tk.Frame(window, bg=BG, padx=22, pady=16)
        frame.pack(fill='both', expand=True)
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(5, weight=1)
        tk.Label(frame, text='Atualizações do AEBOT', bg=BG, fg=BLUE, font=('Segoe UI', 18, 'bold')).grid(row=0, column=0, columnspan=2, sticky='w')
        tk.Label(frame, text='Versões verificadas · feedbacks preservados · sem senha no AEBOT', bg=BG, fg=MUTED,
            font=('Segoe UI', 9), wraplength=500, justify='left').grid(row=1, column=0, columnspan=2, sticky='ew', pady=(5, 10))
        tk.Label(frame, text='Pasta da empresa sincronizada', bg=BG, fg=FG, font=('Segoe UI', 10)).grid(row=2, column=0, sticky='w')
        self.source_entry = tk.Entry(frame, textvariable=self.source, state='readonly', relief='flat', readonlybackground=SURFACE, fg=FG)
        self.source_entry.grid(row=3, column=0, sticky='ew', ipady=8, pady=(4, 8))
        self.choose_button = button(frame, 'Escolher pasta', self.choose_source)
        self.choose_button.grid(row=3, column=1, padx=(8, 0), pady=(4, 8))
        self.detail = tk.Label(frame, textvariable=self.status, bg=BG, fg=FG, wraplength=620, justify='left', anchor='nw', font=('Segoe UI', 10))
        self.detail.grid(row=4, column=0, columnspan=2, sticky='ew', pady=(4, 6))
        self.notes = tk.Text(frame, height=3, wrap='word', state='disabled', bg=SURFACE, fg=FG,
            bd=0, padx=12, pady=8, font=('Segoe UI', 10))
        self.notes.grid(row=5, column=0, columnspan=2, sticky='nsew')
        self.progress = ttk.Progressbar(frame, mode='indeterminate')
        self.progress.grid(row=6, column=0, columnspan=2, sticky='ew', pady=(8, 8))
        actions = tk.Frame(frame, bg=BG)
        actions.grid(row=7, column=0, columnspan=2, sticky='ew')
        actions.columnconfigure((0, 1), weight=1)
        self.check_button = button(actions, 'Procurar atualizações', self.search)
        self.apply_button = button(actions, 'Atualizar agora', self.apply, primary=True)
        self.open_button = button(actions, 'Abrir AEBOT', self.open_app)
        self.cancel_button = button(actions, 'Cancelar operação', self.cancel_operation)
        for widget, row, column in [(self.check_button, 0, 0), (self.apply_button, 0, 1),
                                    (self.open_button, 1, 0), (self.cancel_button, 1, 1)]:
            widget.grid(row=row, column=column, sticky='ew', padx=3, pady=3)
        extra = tk.Frame(frame, bg=BG)
        extra.grid(row=8, column=0, columnspan=2, sticky='ew', pady=(6, 0))
        self.extra_buttons = []
        for name, action in [('Pacote manual', self.choose_package), ('Voltar versão', self.revert), ('Alterar instalação', self.choose_root)]:
            widget = tk.Button(extra, text=name, command=action, bg=BG, fg=BLUE, relief='flat', font=('Segoe UI', 9), padx=5, pady=4)
            widget.pack(side='left', padx=(0, 8))
            self.extra_buttons.append(widget)
        self.controls = [self.choose_button, self.check_button, self.apply_button, self.open_button, self.cancel_button] + self.extra_buttons
        frame.bind('<Configure>', lambda event: self.detail.configure(wraplength=max(300, event.width - 12)))
        window.protocol('WM_DELETE_WINDOW', self.close)
        self.refresh_controls()
        window.after(80, self.poll)
        if auto_check:
            window.after(250, self.search)

    def client(self):
        return ChannelClient(Path(self.root.get()), self.storage, self.nearby)

    def refresh_controls(self):
        for control in self.controls:
            control.configure(state='disabled' if self.busy else 'normal')
        ready = self.selection is not None or self.manual_archive is not None
        self.apply_button.configure(state='normal' if ready and not self.busy else 'disabled',
            text='Atualizar agora' if (Path(self.root.get()) / 'AEBOT.exe').is_file() else 'Instalar AEBOT')
        self.open_button.configure(state='normal' if not self.busy and (Path(self.root.get()) / 'AEBOT.exe').is_file() else 'disabled')
        self.cancel_button.configure(state='normal' if self.busy and self.phase != 'applying' else 'disabled')

    def show_notes(self, text):
        self.notes.configure(state='normal')
        self.notes.delete('1.0', 'end')
        self.notes.insert('1.0', text)
        self.notes.configure(state='disabled')

    def choose_source(self):
        value = filedialog.askdirectory(title='Pasta AEBOT da empresa, sincronizada pelo OneDrive', parent=self.window)
        if value:
            try:
                save_source(self.storage, value)
            except ValueError as error:
                messagebox.showerror('Origem não salva', str(error), parent=self.window)
                return
            self.source.set(value)
            self.search()

    def choose_root(self):
        value = filedialog.askdirectory(title='Pasta original da instalação AEBOT', parent=self.window)
        if value:
            self.root.set(value)
            self.selection = self.manual_archive = None
            self.refresh_controls()

    def choose_package(self):
        value = filedialog.askopenfilename(title='Pacote manual do AEBOT', filetypes=[('Atualização AEBOT', '*.aebot-update')], parent=self.window)
        if value:
            self.package.set(value)
            self.preview()

    def preview(self):
        try:
            data = inspect_update(Path(self.package.get())).data
            self.manual_archive = Path(self.package.get())
            self.selection = None
            self.status.set(f"Pacote assinado: {data['fromVersion']} → {data['toVersion']}")
            self.show_notes(data['notes'])
            self.refresh_controls()
        except Exception:
            self.manual_archive = None
            self.refresh_controls()
            messagebox.showerror('Pacote não reconhecido', 'Selecione um .aebot-update íntegro publicado pelo responsável.', parent=self.window)

    def work(self, action, kind='status'):
        if self.busy:
            return
        self.busy, self.phase = True, kind
        self.cancel.clear()
        self.progress.start(16)
        self.refresh_controls()
        def execute():
            try:
                self.events.put(('result', kind, action()))
            except Exception as error:
                self.events.put(('error', kind, str(error) if isinstance(error, ValueError) else
                    'Não consegui concluir. Confira a sincronização, o espaço e a permissão da pasta. A instalação foi preservada.'))
        threading.Thread(target=execute, daemon=True).start()

    def search(self):
        if self.busy:
            return
        self.selection = self.manual_archive = None
        self.status.set('Procurando na pasta da empresa… Nenhuma conversa será enviada.')
        self.show_notes('')
        client = self.client()
        self.work(lambda: client.check(self.cancel), 'check')

    def apply(self):
        if not (self.selection or self.manual_archive) or self.busy:
            return
        if not messagebox.askyesno('Instalar atualização', 'O chat está fechado? Vou obter o pacote, conferir assinatura e hashes e testar o aplicativo. Feedbacks não serão alterados.', parent=self.window):
            return
        root, checked, manual, client = Path(self.root.get()), self.selection, self.manual_archive, self.client()
        def install():
            archive = manual or client.download(checked, self.cancel)
            if self.cancel.is_set():
                raise UpdateError('Operação cancelada antes da instalação.')
            self.events.put(('phase', 'applying', 'Conferindo e testando a versão… Aguarde a conclusão.'))
            action = apply_update if (root / 'AEBOT.exe').is_file() else install_full
            number = action(root, archive, cancelled=self.cancel.is_set)
            return 'Versão ' + number + ' pronta. Clique em Abrir AEBOT. Feedbacks preservados.'
        self.status.set('Obtendo o pacote da pasta da empresa…')
        self.work(install, 'download')

    def revert(self):
        if messagebox.askyesno('Voltar versão', 'Com o chat fechado, deseja voltar à versão anterior preservada?', parent=self.window):
            root = Path(self.root.get())
            self.work(lambda: 'Versão anterior ativada: ' + rollback(root) + '.', 'applying')

    def open_app(self):
        try:
            launch_application(Path(self.root.get()))
            self.window.destroy()
        except Exception:
            messagebox.showerror('AEBOT não iniciado', 'Confira a instalação ou use Voltar versão. Não abrirei outra versão silenciosamente.', parent=self.window)

    def cancel_operation(self):
        if self.busy and self.phase != 'applying':
            self.cancel.set()
            self.status.set('Cancelando a leitura da distribuição…')

    def poll(self):
        try:
            while True:
                event, kind, result = self.events.get_nowait()
                if event == 'phase':
                    self.phase = kind
                    self.status.set(result)
                    self.refresh_controls()
                    continue
                self.busy = False
                self.progress.stop()
                if event == 'error':
                    self.selection = self.manual_archive = None
                    self.status.set(result)
                elif kind == 'check':
                    self.source.set(result['source'])
                    if result['status'] == 'available':
                        self.selection = result
                        release = result['release']
                        self.status.set(f"Versão {release['toVersion']} disponível · {release['size'] / 1024**2:.1f} MB")
                        self.show_notes(release['notes'])
                    elif result['status'] == 'current':
                        self.status.set('Sem versão mais nova no catálogo sincronizado. Instalado: ' + str(result['installed']) + '; catálogo: ' + result['latest'] + '.')
                    else:
                        self.status.set('Há versão nova, mas falta um pacote compatível com esta instalação. Avise o responsável; a atual continua funcionando.')
                else:
                    self.selection = self.manual_archive = None
                    self.status.set(result)
                self.refresh_controls()
        except queue.Empty:
            pass
        self.window.after(80, self.poll)

    def close(self):
        if self.busy:
            if self.phase == 'applying':
                messagebox.showinfo('Conferência em andamento', 'Aguarde o teste e a ativação terminarem.', parent=self.window)
            else:
                self.cancel_operation()
        else:
            self.window.destroy()

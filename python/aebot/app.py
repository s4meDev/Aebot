"""Interface leve. A inferência fica fora da thread que desenha a janela."""
from __future__ import annotations
import queue
import threading
import time
import tkinter as tk
from tkinter import ttk
from .contracts import Evaluation
from .runtime import load_engine, resources_root
from .session import Session
from .store import RuleStore

SERVICES = ('repavimentacao-asfalto-ate-1m2', 'repavimentacao-asfalto-acima-1m2')


class App:
    def __init__(self, window: tk.Tk):
        self.window = window
        self.session: Session | None = None
        self.events: queue.Queue = queue.Queue()
        self.busy = True
        self.turns = 0
        window.title('AEBOT • Repavimentação Asfalto')
        window.geometry('820x720')
        window.minsize(580, 530)
        window.configure(bg='#101113')
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TCombobox', fieldbackground='#22252a', background='#22252a',
            foreground='#f2f2f2', arrowcolor='#b8bcc5', bordercolor='#33363e', padding=10)
        style.map('TCombobox', fieldbackground=[('readonly', '#22252a')],
            foreground=[('readonly', '#f2f2f2')], selectbackground=[('readonly', '#22252a')],
            selectforeground=[('readonly', '#ffffff')])
        window.option_add('*TCombobox*Listbox.background', '#22252a')
        window.option_add('*TCombobox*Listbox.foreground', '#f2f2f2')
        window.option_add('*TCombobox*Listbox.selectBackground', '#284cbe')
        header = tk.Frame(window, bg='#101113', padx=26, pady=18)
        header.pack(fill='x')
        tk.Label(header, text='AEBOT', fg='#fafafa', bg='#101113', font=('Segoe UI', 20, 'bold')).pack(anchor='w')
        tk.Label(header, text='Assistente de análise  /  Asfalto', fg='#a5a9b4', bg='#101113', font=('Segoe UI', 10)).pack(anchor='w')
        self.status = tk.StringVar(value='Preparando a IA local…')
        tk.Label(header, textvariable=self.status, fg='#a5a9b4', bg='#101113', font=('Segoe UI', 9)).pack(anchor='w', pady=(7, 12))
        store = RuleStore(resources_root())
        self.names = [store.services[item]['name'] for item in SERVICES]
        self.service = ttk.Combobox(header, values=self.names, state='readonly', font=('Segoe UI', 11))
        self.service.current(0)
        self.service.pack(fill='x')
        self.service.bind('<<ComboboxSelected>>', lambda _: self.new_case())
        self.chat = tk.Text(window, bg='#101113', fg='#e9e9ec', font=('Segoe UI', 11),
            wrap='word', padx=26, pady=12, bd=0, highlightthickness=0, state='disabled', cursor='arrow')
        self.chat.pack(fill='both', expand=True)
        self.chat.tag_configure('user', foreground='#99aeea', spacing1=18, spacing3=7)
        self.chat.tag_configure('assistant', foreground='#e9e9ec', spacing3=14)
        self.chat.tag_configure('meta', foreground='#888e9c', font=('Segoe UI', 9), spacing3=16)
        footer = tk.Frame(window, bg='#101113', padx=22, pady=16)
        footer.pack(fill='x')
        self.input = tk.Text(footer, bg='#22252a', fg='white', insertbackground='white',
            font=('Segoe UI', 11), height=3, wrap='word', bd=0, padx=14, pady=12)
        self.input.pack(fill='x')
        self.input.bind('<Return>', self.enter)
        buttons = tk.Frame(footer, bg='#101113')
        buttons.pack(fill='x', pady=(10, 0))
        self.reset_button = tk.Button(buttons, text='Novo caso', command=self.new_case, bg='#22252a', fg='#eee',
            relief='flat', padx=14, pady=9, font=('Segoe UI', 10))
        self.reset_button.pack(side='left')
        self.send_button = tk.Button(buttons, text='Enviar  →', command=self.send, bg='#284cbe', fg='white',
            relief='flat', padx=22, pady=9, font=('Segoe UI', 10, 'bold'), state='disabled')
        self.send_button.pack(side='right')
        tk.Label(footer, text='Local e sem API • Conversa somente em memória • Revise a orientação antes de concluir a OS',
            fg='#888e9c', bg='#101113', font=('Segoe UI', 8), wraplength=730).pack(pady=(12, 0))
        self.append('Conte o que encontrou na OS. Se faltar uma informação que muda a regra, eu pergunto.\n', 'assistant')
        threading.Thread(target=self.load, daemon=True).start()
        window.after(60, self.poll)

    def append(self, text: str, tag: str) -> None:
        self.chat.configure(state='normal')
        self.chat.insert('end', text + '\n', tag)
        self.chat.configure(state='disabled')
        self.chat.see('end')

    def load(self) -> None:
        started = time.perf_counter()
        try:
            engine = load_engine()
            self.events.put(('loaded', (Session(engine), (time.perf_counter() - started) * 1000)))
        except Exception as error:
            self.events.put(('error', str(error)))

    def poll(self) -> None:
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == 'loaded':
                    self.session, elapsed = value
                    self.status.set(f'IA local pronta • Base {self.session.engine.store.version} • abertura {elapsed / 1000:.1f}s')
                elif kind == 'answer':
                    result: Evaluation = value
                    self.append(result.content, 'assistant')
                    self.append(f'{result.durationMs / 1000:.2f}s • contexto {"continuado" if result.contextApplied else "novo"}', 'meta')
                    self.status.set('Pronto para continuar ou começar outro caso')
                else:
                    self.append('Não consegui executar esta análise. ' + value, 'assistant')
                    self.status.set('Falha local — confira os arquivos e tente novamente')
                self.busy = False
                self.send_button.configure(state='normal' if self.session else 'disabled')
                self.reset_button.configure(state='normal')
                self.service.configure(state='readonly')
        except queue.Empty:
            pass
        self.window.after(60, self.poll)

    def enter(self, event: tk.Event) -> str | None:
        if event.state & 0x1:
            return None
        self.send()
        return 'break'

    def send(self) -> None:
        text = self.input.get('1.0', 'end').strip()
        if self.busy or not self.session or not text:
            return
        if len(text) > 4000:
            self.append('Resuma este relato em até 4.000 caracteres, sem dados pessoais.', 'assistant')
            return
        self.input.delete('1.0', 'end')
        self.append('Você\n' + text, 'user')
        self.busy = True
        self.turns += 1
        if self.turns > 80:
            # Limito o desenho do chat, não a quantidade de análises do dia.
            self.chat.configure(state='normal')
            self.chat.delete('1.0', 'end')
            self.chat.configure(state='disabled')
            self.turns = 1
        self.status.set('Analisando as regras…')
        self.send_button.configure(state='disabled')
        self.reset_button.configure(state='disabled')
        self.service.configure(state='disabled')
        service_id = SERVICES[self.service.current()]
        def work() -> None:
            try:
                self.events.put(('answer', self.session.ask(text, service_id)))
            except Exception:
                self.events.put(('error', 'A interpretação falhou; nenhuma conclusão foi emitida. Tente um relato mais curto.'))
        threading.Thread(target=work, daemon=True).start()

    def new_case(self) -> None:
        if self.busy:
            return
        if self.session:
            self.session.reset()
        self.chat.configure(state='normal')
        self.chat.delete('1.0', 'end')
        self.chat.configure(state='disabled')
        self.turns = 0
        self.append('Novo caso. O contexto anterior foi descartado. Conte o que encontrou nesta OS.', 'assistant')


def run() -> None:
    window = tk.Tk()
    App(window)
    window.mainloop()

"""Interface do protótipo. Reservo espaço para digitar antes de expandir o chat."""
from __future__ import annotations
import queue
import threading
import time
import sys
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox
from .contracts import Evaluation
from .runtime import load_engine, resources_root
from .session import Session
from .store import RuleStore
from . import __version__
from .feedback import FeedbackStore
from .feedback_ui import FeedbackDialog, FeedbackReader
from .response import format_response
from .case_overview import build_overview, CaseOverview
from .overview_ui import OverviewPanel, ContextPrompt
from .theme import (BG, SURFACE, FG, MUTED, BLUE, NAVY, BORDER, SOFT_BLUE,
    GREEN, SOFT_GREEN, AMBER, SOFT_AMBER, RED, SOFT_RED, configure_theme, button)


class App:
    def __init__(self, window: tk.Tk, feedback_directory=None, engine_loader=None):
        self.window = window
        self.session: Session | None = None
        self.events: queue.Queue = queue.Queue()
        self.busy = True
        self.turns = 0
        self.closed = False
        self.latest_result: Evaluation | None = None
        self.evidence_reader = None
        self._poll_job = None
        self._engine_loader = engine_loader or load_engine
        self.failed_turn = False
        self.busy_since = None
        self.submitted_text = ''
        self.feedback_store = FeedbackStore(feedback_directory)
        self.store = RuleStore(resources_root(), prototype=True)
        self.service_ids = tuple(self.store.services)
        self.base_version = self.store.version
        self.names = [self.store.services[item]['name'] for item in self.service_ids]
        window.title(f'AEBOT | {self.store.profile["title"]} | {__version__}')
        width = max(580, min(1180, window.winfo_screenwidth() - 80))
        height = max(500, min(780, window.winfo_screenheight() - 120))
        window.geometry(f'{width}x{height}+30+30')
        window.minsize(580, 500)
        window.configure(bg=BG)
        configure_theme(window)
        # Só a linha do chat cresce. O campo de mensagem e os botões ficam
        # reservados mesmo quando a janela é menor que o tamanho recomendado.
        window.columnconfigure(0, weight=1)
        window.rowconfigure(1, weight=1)
        self.build_header()
        body = self.body = tk.Frame(window, bg=BG, padx=22, pady=10)
        body.grid(row=1, column=0, sticky='nsew')
        body.columnconfigure(0, weight=1)
        body.rowconfigure(1, weight=1)
        self.build_service_bar(body)
        self.build_chat(body)
        self.build_composer(body)
        self.overview = OverviewPanel(body)
        self.sidebar_visible = False
        self.compact_layout = False
        body.bind('<Configure>', self.layout_overview)
        self.window.bind('<Control-n>', lambda _: self.request_new_case())
        self.window.bind('<Control-l>', lambda _: self.input.focus_set())
        self.window.bind('<Control-Return>', lambda _: self.send())
        footer = tk.Frame(window, bg=BG)
        footer.grid(row=2, column=0, sticky='ew', padx=22, pady=(0, 10))
        self.status = tk.StringVar(value='Preparando a IA local…')
        status_label = tk.Label(footer, textvariable=self.status, bg=BG, fg=MUTED, anchor='w',
            font=('Segoe UI', 9), wraplength=260, justify='left')
        status_label.pack(side='left')
        privacy_label = tk.Label(footer, text=f'v{__version__}  ·  Conversa só em memória', bg=BG, fg=MUTED,
            font=('Segoe UI', 9))
        privacy_label.pack(side='right')
        footer.bind('<Configure>', lambda event: status_label.configure(
            wraplength=max(120, event.width - privacy_label.winfo_reqwidth() - 12)))
        self.append('Conte o que encontrou na OS ou tire uma dúvida sobre as regras. Se faltar um detalhe importante, eu pergunto.', 'assistant')
        self.set_busy(True)
        window.bind('<Destroy>', self.destroyed, add='+')
        threading.Thread(target=self.load, daemon=True).start()
        self._poll_job = window.after(60, self.poll)

    def build_header(self):
        header = self.header = tk.Frame(self.window, bg=SURFACE, padx=24, pady=12)
        header.grid(row=0, column=0, sticky='ew')
        header.columnconfigure(0, weight=1)
        brand = tk.Frame(header, bg=SURFACE)
        brand.grid(row=0, column=0, sticky='w')
        wordmark = tk.Frame(brand, bg=SURFACE)
        wordmark.pack(anchor='w')
        tk.Label(wordmark, text='AEBOT', bg=SURFACE, fg=NAVY,
            font=('Segoe UI', 22, 'bold')).pack(side='left')
        tk.Label(wordmark, text='LOCAL', bg=SOFT_BLUE, fg=BLUE, padx=8, pady=3,
            font=('Segoe UI', 8, 'bold')).pack(side='left', padx=12)
        self.header_subtitle = tk.Label(brand, text='Análise de serviços, com as regras por perto.', bg=SURFACE, fg=MUTED,
            font=('Segoe UI', 10))
        self.header_subtitle.pack(anchor='w', pady=(2, 0))
        self.update_button = button(header, 'Atualizar', self.open_updater)
        self.update_button.grid(row=0, column=1, sticky='e', padx=(8, 12))
        if not getattr(sys, 'frozen', False):
            self.update_button.configure(state='disabled')
        self.logo = None
        logo_path = resources_root() / 'python/assets/aegea.png'
        if logo_path.is_file():
            self.logo = tk.PhotoImage(file=str(logo_path))
            self.logo = self.logo.subsample(max(1, (self.logo.width() + 129) // 130))
            tk.Label(header, image=self.logo, bg=SURFACE).grid(row=0, column=2, sticky='e', padx=(16, 0))
        else:
            # A falta da imagem não impede consultar uma regra.
            tk.Label(header, text='aegea', bg=SURFACE, fg=BLUE,
                font=('Segoe UI', 18)).grid(row=0, column=2, sticky='e')
        tk.Frame(self.window, bg=BORDER, height=1).grid(row=0, column=0, sticky='sew')

    def build_service_bar(self, body):
        bar = tk.Frame(body, bg=BG)
        bar.grid(row=0, column=0, columnspan=2, sticky='ew', pady=(0, 12))
        bar.columnconfigure(0, weight=1)
        tk.Label(bar, text='SERVIÇO DA OS', bg=BG, fg=MUTED,
            font=('Segoe UI', 9, 'bold')).grid(row=0, column=0, sticky='w', pady=(0, 6))
        self.service = ttk.Combobox(bar, values=self.names, state='disabled', font=('Segoe UI', 11))
        self.service.current(0)
        self.service.grid(row=1, column=0, sticky='ew')
        self.service.bind('<<ComboboxSelected>>', lambda _: self.new_case())
        self.rules_button = button(bar, 'Regras e fluxo', self.open_rules)
        self.rules_button.grid(row=1, column=1, padx=(10, 0), sticky='ns')

    def build_chat(self, body):
        frame = tk.Frame(body, bg=SURFACE, highlightthickness=1, highlightbackground=BORDER)
        frame.grid(row=1, column=0, sticky='nsew')
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(1, weight=1)
        heading = self.chat_heading = tk.Frame(frame, bg=SURFACE, padx=18, pady=12)
        heading.grid(row=0, column=0, columnspan=2, sticky='ew')
        tk.Label(heading, text='Conversa sobre a OS', bg=SURFACE, fg=NAVY,
            font=('Segoe UI', 11, 'bold')).pack(side='left')
        self.result_badge = tk.Label(heading, text='Consulta local', bg=SOFT_BLUE, fg=BLUE,
            font=('Segoe UI', 9, 'bold'), padx=10, pady=5)
        self.result_badge.pack(side='right')
        self.chat = tk.Text(frame, bg=SURFACE, fg=FG, font=('Segoe UI', 11),
            wrap='word', padx=20, pady=10, bd=0, highlightthickness=0,
            state='disabled', cursor='arrow', height=6)
        scroll = ttk.Scrollbar(frame, orient='vertical', command=self.chat.yview)
        self.chat.configure(yscrollcommand=scroll.set)
        self.chat.grid(row=1, column=0, sticky='nsew')
        scroll.grid(row=1, column=1, sticky='ns')
        self.chat.tag_configure('user', foreground=FG, background=SOFT_BLUE, spacing1=8, spacing3=8,
            rmargin=12)
        self.chat.tag_configure('assistant', foreground=FG, spacing3=5, lmargin1=4, lmargin2=4, rmargin=24)
        self.chat.tag_configure('user_label', foreground=BLUE, font=('Segoe UI', 10, 'bold'), spacing1=14, spacing3=5)
        self.chat.tag_configure('assistant_label', foreground=NAVY, font=('Segoe UI', 10, 'bold'), spacing1=14, spacing3=5)
        self.chat.tag_configure('meta', foreground=MUTED, font=('Segoe UI', 9), spacing3=12)
        self.chat.bind('<Configure>', self.layout_chat)
        self.context_prompt = ContextPrompt(frame, self.answer_context)
        self.context_prompt.frame.grid(row=2, column=0, columnspan=2, sticky='ew', padx=12, pady=(0, 8))
        self.context_prompt.frame.grid_remove()

    def build_composer(self, body):
        self.composer = tk.Frame(body, bg=BG)
        self.composer.grid(row=2, column=0, columnspan=2, sticky='ew', pady=(12, 0))
        self.composer.columnconfigure(0, weight=1)
        self.input = tk.Text(self.composer, bg=SURFACE, fg=FG, insertbackground=BLUE,
            font=('Segoe UI', 11), height=2, wrap='word', bd=0, padx=14, pady=10,
            highlightthickness=1, highlightbackground=BORDER, highlightcolor=BLUE)
        self.input.grid(row=0, column=0, columnspan=3, sticky='ew')
        self.input.bind('<Return>', self.enter)
        self.input.bind('<Tab>', self.next_control)
        self.input.bind('<<Modified>>', self.resize_input)
        tk.Label(self.composer, text='Enter envia · Shift + Enter: nova linha',
            bg=BG, fg=MUTED, font=('Segoe UI', 9)).grid(row=1, column=0, sticky='w', pady=(8, 0))
        self.reset_button = button(self.composer, 'Novo caso', self.request_new_case)
        self.reset_button.configure(state='disabled')
        self.reset_button.grid(row=1, column=1, padx=(8, 8), pady=(8, 0))
        self.send_button = button(self.composer, 'Enviar', self.send, primary=True)
        self.send_button.configure(state='disabled')
        self.send_button.grid(row=1, column=2, pady=(8, 0))
        actions = tk.Frame(self.composer, bg=BG)
        actions.grid(row=2, column=0, columnspan=3, sticky='ew', pady=(8, 0))
        for title, command in [('Enviar feedback', self.open_feedback), ('Feedbacks salvos', self.open_feedback_reader)]:
            tk.Button(actions, text=title, command=command, bg=BG, fg=BLUE,
                activebackground=SOFT_BLUE, activeforeground=NAVY, relief='flat',
                cursor='hand2', font=('Segoe UI', 9), padx=5, pady=3).pack(side='left', padx=(0, 12))
        self.evidence_button = tk.Button(actions, text='Ver fundamentos', command=self.open_evidence,
            bg=BG, fg=BLUE, activebackground=SOFT_BLUE, activeforeground=NAVY, relief='flat',
            cursor='hand2', font=('Segoe UI', 9), padx=5, pady=3, state='disabled')
        self.evidence_button.pack(side='right')
        self.copy_button = tk.Button(actions, text='Copiar resposta', command=self.copy_response,
            bg=BG, fg=BLUE, activebackground=SOFT_BLUE, activeforeground=NAVY, relief='flat',
            cursor='hand2', font=('Segoe UI', 9), padx=5, pady=3, state='disabled')
        self.copy_button.pack(side='right', padx=(0, 6))
        self.progress_host = tk.Frame(self.composer, bg=BG, height=3)
        self.progress_host.grid(row=3, column=0, columnspan=3, sticky='ew', pady=(5, 0))
        self.progress = ttk.Progressbar(self.progress_host, mode='indeterminate', maximum=100,
            style='Aebot.Horizontal.TProgressbar')
        self.retry_button = button(actions, 'Tentar novamente', self.retry_load)

    def layout_chat(self, event):
        # A margem acompanha a janela; uma tela estreita não perde o texto.
        left = max(18, min(90, event.width // 9))
        self.chat.tag_configure('user', lmargin1=left, lmargin2=left)
        self.chat.tag_configure('user_label', lmargin1=left, lmargin2=left)
        self.chat.after_idle(lambda: self.chat.yview_moveto(1.0) if not self.closed else None)

    def resize_input(self, event=None):
        if self.input.edit_modified() or event is None:
            self.input.edit_modified(False)
            # O campo vazio ocupa uma linha na janela baixa e cresce ao
            # escrever. O chat ganha espaço sem esconder o envio.
            count = self.input.count('1.0', 'end-1c', 'displaylines')
            height = min(2, (count[0] if count else 0) + 1) if self.compact_layout else 2
            self.input.configure(height=height)

    def layout_overview(self, event):
        compact = self.window.winfo_height() < 630
        if compact != self.compact_layout:
            self.compact_layout = compact
            if compact:
                self.header_subtitle.pack_forget()
            else:
                self.header_subtitle.pack(anchor='w', pady=(2, 0))
            self.header.configure(pady=8 if compact else 12)
            self.body.configure(pady=6 if compact else 10)
            self.chat_heading.configure(pady=7 if compact else 12)
            self.input.configure(pady=6 if compact else 10)
            self.resize_input()
            self.composer.grid_configure(pady=(8 if compact else 12, 0))
            for control in (self.send_button, self.reset_button):
                control.configure(pady=6 if compact else 9)
            self.window.after_idle(lambda: self.chat.see('end') if not self.closed else None)
        visible = event.width >= 970
        if visible != self.sidebar_visible:
            self.sidebar_visible = visible
            if visible:
                self.overview.frame.grid(row=1, column=1, sticky='nsew', padx=(14, 0))
            else:
                self.overview.frame.grid_remove()

    def refresh_overview(self):
        if self.busy:
            overview = CaseOverview('Conferindo o relato', 'Aguarde a resposta deste turno. Não uso os fundamentos anteriores como resultado novo.')
        elif self.failed_turn or (self.latest_result and self.latest_result.errorCode):
            overview = CaseOverview('Turno não concluído', 'Não emiti conclusão para esta tentativa. O rascunho pode ser corrigido e enviado novamente.')
        else:
            case = self.session.scenario.last if self.session and self.session.scenario else self.session.case_last if self.session else None
            overview = build_overview(self.store, case, self.session.pending if self.session else None)
        self.overview.show(overview)
        self.context_prompt.show(overview, self.busy)

    def answer_context(self, text):
        if self.busy or not self.session or not self.session.pending:
            return
        draft = self.input.get('1.0', 'end').strip()
        self.input.delete('1.0', 'end')
        separate = bool(draft and self.session.engine.text.intent(draft) in ('question', 'hypothesis'))
        self.input.insert('1.0', (draft + '. ' if draft and not separate else '') + text)
        self.send()
        if separate:
            # Uma dúvida ou hipótese ainda não enviada não pode virar fato
            # do caso só porque o analista confirmou uma opção da equipe.
            self.input.insert('1.0', draft)

    def copy_response(self):
        if self.latest_result and not self.busy:
            self.window.clipboard_clear()
            self.window.clipboard_append(format_response(self.latest_result, references=True, compact=True))
            self.status.set('Resposta e regras copiadas por sua solicitação')

    def request_new_case(self):
        if self.busy:
            return
        if self.input.get('1.0', 'end').strip() and not messagebox.askyesno('Novo caso', 'Descartar o rascunho não enviado e começar outra OS?', parent=self.window):
            return
        self.new_case()

    def set_busy(self, busy):
        self.busy = busy
        self.busy_since = time.monotonic() if busy else None
        ready = self.session is not None and not busy
        # Posso preparar o próximo texto enquanto a análise trabalha. O envio
        # continua bloqueado para não haver duas mutações do mesmo caso.
        self.input.configure(state='normal' if self.session else 'disabled')
        self.send_button.configure(state='normal' if ready else 'disabled', text='Analisando…' if busy and self.session else 'Enviar')
        self.reset_button.configure(state='disabled' if busy else 'normal')
        self.service.configure(state='disabled' if busy else 'readonly')
        self.update_button.configure(state='normal' if getattr(sys, 'frozen', False) and not busy else 'disabled')
        self.evidence_button.configure(state='normal' if self.latest_result and not busy else 'disabled')
        self.copy_button.configure(state='normal' if self.latest_result and not busy else 'disabled')
        self.refresh_overview()
        if busy:
            self.progress.place(x=0, y=0, relwidth=1, height=3)
            self.progress.start(14)
        else:
            self.progress.stop()
            # A faixa reserva a altura, mas não parece carregando em repouso.
            self.progress.place_forget()

    def retry_load(self):
        if self.busy or self.session:
            return
        self.retry_button.pack_forget()
        self.evidence_button.pack(side='right')
        self.status.set('Conferindo os arquivos e preparando a IA local…')
        self.set_busy(True)
        threading.Thread(target=self.load, daemon=True).start()

    def append(self, text: str, tag: str) -> None:
        self.chat.configure(state='normal')
        if tag in ('user', 'assistant'):
            self.chat.insert('end', ('Você' if tag == 'user' else 'AEBOT') + '\n', tag + '_label')
        self.chat.insert('end', text + '\n', tag)
        self.chat.configure(state='disabled')
        self.chat.see('end')

    def load(self) -> None:
        started = time.perf_counter()
        try:
            engine = self._engine_loader()
            if engine.store.data != self.store.data:
                # Não mostro um catálogo enquanto o motor usa outra base.
                # Atualizações precisam da pasta completa e de nova abertura.
                raise ValueError('A base da interface difere da base da análise.')
            self.events.put(('loaded', (Session(engine), (time.perf_counter() - started) * 1000)))
        except Exception:
            self.events.put(('error', 'Confira os arquivos do modelo e da base. Nenhuma pergunta foi enviada à internet.'))

    def poll(self) -> None:
        if self.closed:
            return
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == 'loaded':
                    self.session, elapsed = value
                    self.status.set(f'IA local pronta · Base {self.base_version} · abertura {elapsed / 1000:.1f}s')
                elif kind == 'answer':
                    result: Evaluation = value
                    self.latest_result = result
                    self.failed_turn = bool(result.errorCode)
                    self.append(format_response(result, references=False, compact=True), 'assistant')
                    if result.intent in ('question', 'hypothesis'):
                        self.append(('consulta' if result.intent == 'question' else 'hipótese') + ' · não altera a OS', 'meta')
                    count = len(result.matchedRules)
                    if result.errorCode:
                        self.status.set('Falha local · nenhuma conclusão emitida')
                    elif result.pendingInformation:
                        self.status.set('Aguardando esclarecimento')
                    elif result.intent == 'question' and self.session.pending:
                        self.status.set('Consulta concluída · o contexto anterior ainda aguarda esclarecimento')
                    else:
                        self.status.set('Pronto para continuar ou começar outro caso')
                    if not result.errorCode:
                        self.status.set(self.status.get() + f' · {count} regra(s) · {result.durationMs / 1000:.1f}s')
                    elif not self.input.get('1.0', 'end').strip():
                        self.input.insert('1.0', self.submitted_text)
                    self.update_badge(result)
                else:
                    self.failed_turn = True
                    if self.session and not self.input.get('1.0', 'end').strip():
                        self.input.insert('1.0', self.submitted_text)
                    self.append('Não consegui executar esta análise. ' + value, 'assistant')
                    self.status.set('Falha local · confira os arquivos')
                    self.result_badge.configure(text='Falha local', bg=SOFT_RED, fg=RED)
                    if not self.session:
                        self.evidence_button.pack_forget()
                        self.retry_button.pack(side='right', padx=6)
                self.set_busy(False)
                if self.session:
                    self.input.focus_set()
        except queue.Empty:
            pass
        if self.busy and self.busy_since and time.monotonic() - self.busy_since >= 5:
            seconds = int(time.monotonic() - self.busy_since)
            self.status.set(('Interpretando o relato' if self.session else 'Preparando a IA local') + f'… {seconds}s · aguarde')
        self._poll_job = self.window.after(60, self.poll)

    def update_badge(self, result=None):
        text, bg, fg = 'Consulta local', SOFT_BLUE, BLUE
        if result:
            if result.errorCode:
                text, bg, fg = 'Falha técnica', SOFT_RED, RED
            elif result.decision:
                text = result.decision
                bg, fg = {'Conforme': (SOFT_GREEN, GREEN), 'Não Conforme': (SOFT_AMBER, AMBER),
                    'Reprovado': (SOFT_RED, RED)}[result.decision]
            elif result.pendingInformation:
                text, bg, fg = 'Falta confirmar', SOFT_AMBER, AMBER
            elif result.intent == 'hypothesis':
                text = 'Hipótese'
            elif result.outcome == 'advisory':
                text = 'Orientação parcial'
        self.result_badge.configure(text=text, bg=bg, fg=fg)

    def enter(self, event: tk.Event) -> str | None:
        if event.state & 0x1:
            return None
        self.send()
        return 'break'

    def next_control(self, event):
        event.widget.tk_focusNext().focus_set()
        return 'break'

    def send(self) -> None:
        text = self.input.get('1.0', 'end').strip()
        if self.busy or not self.session or not text:
            return
        index = self.service.current()
        if not 0 <= index < len(self.service_ids):
            messagebox.showerror('Serviço não selecionado', 'Selecione um serviço válido antes de analisar.', parent=self.window)
            return
        if len(text) > 4000:
            self.append('Resuma este relato em até 4.000 caracteres, sem dados pessoais.', 'assistant')
            return
        if self.turns >= 80:
            self.chat.configure(state='normal')
            self.chat.delete('1.0', 'end')
            self.chat.configure(state='disabled')
            self.append('Exibindo as mensagens recentes deste mesmo caso. Use Novo caso ao mudar de OS.', 'meta')
            self.turns = 0
        self.input.delete('1.0', 'end')
        self.submitted_text = text
        self.failed_turn = False
        self.append(text, 'user')
        self.close_evidence()
        # Se o próximo turno falhar, os fundamentos antigos não podem parecer
        # a explicação dessa tentativa. A resposta anterior continua no chat.
        self.latest_result = None
        self.turns += 1
        self.status.set('Consultando as regras…')
        self.set_busy(True)
        service_id = self.service_ids[index]
        def work() -> None:
            try:
                self.events.put(('answer', self.session.ask(text, service_id)))
            except Exception:
                self.events.put(('error', 'A interpretação falhou; nenhuma conclusão foi emitida. Tente um relato mais curto.'))
        threading.Thread(target=work, daemon=True).start()

    def open_evidence(self):
        if self.latest_result is not None and not self.busy:
            from .evidence_ui import EvidenceReader
            self.close_evidence()
            self.evidence_reader = EvidenceReader(self.window, self.latest_result)
            return self.evidence_reader

    def close_evidence(self):
        if self.evidence_reader and self.evidence_reader.window.winfo_exists():
            self.evidence_reader.window.destroy()
        self.evidence_reader = None

    def open_rules(self):
        from .rulebook import RulebookReader
        index = self.service.current()
        if not 0 <= index < len(self.service_ids):
            messagebox.showerror('Serviço não selecionado', 'Selecione um serviço válido para consultar a base.', parent=self.window)
            return
        return RulebookReader(self.window, self.store, self.service_ids[index])

    def open_updater(self):
        if self.busy or not getattr(sys, 'frozen', False):
            return
        if not messagebox.askyesno('Atualizar AEBOT', 'Vou fechar o chat para abrir o atualizador. A conversa atual será descartada; os feedbacks salvos permanecem. Continuar?', parent=self.window):
            return
        try:
            from .updates import installation_root, local_file
            root = installation_root(Path(sys.executable).parent)
            # Uso o atualizador da versão ativa. O lançador original 0.7.0
            # continua abrindo o app, mas não limita os recursos novos da tela.
            launcher = local_file(Path(sys.executable).parent, 'Abrir-AEBOT.exe')
            subprocess.Popen([str(launcher), '--update', '--root', str(root)],
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception:
            messagebox.showerror('Atualizador não iniciado', 'Confira se Abrir-AEBOT.exe está na pasta original completa. Nenhum arquivo foi alterado.', parent=self.window)
            return
        self.window.destroy()

    def open_feedback(self):
        index = self.service.current()
        if not 0 <= index < len(self.service_ids):
            messagebox.showerror('Serviço não selecionado', 'Selecione o serviço a que o feedback se refere.', parent=self.window)
            return
        # Nem a pergunta nem a resposta são copiadas para o formulário.
        return FeedbackDialog(self.window, self.feedback_store, dict(service_id=self.service_ids[index],
            service_name=self.names[index], app_version=__version__, base_version=self.base_version))

    def open_feedback_reader(self):
        return FeedbackReader(self.window, self.feedback_store)

    def new_case(self) -> None:
        if self.busy:
            return
        if self.session:
            self.session.reset()
        # A interface também normaliza rascunhos nas respostas rápidas.
        # Esse cache não pode carregar texto para a próxima OS.
        self.store.text.clear_cache()
        self.close_evidence()
        self.chat.configure(state='normal')
        self.chat.delete('1.0', 'end')
        self.chat.configure(state='disabled')
        self.input.delete('1.0', 'end')
        self.turns = 0
        self.latest_result = None
        self.failed_turn = False
        self.submitted_text = ''
        self.evidence_button.configure(state='disabled')
        self.copy_button.configure(state='disabled')
        self.refresh_overview()
        self.update_badge()
        self.status.set('Novo caso · contexto anterior descartado')
        self.append('Novo caso. O contexto anterior foi descartado. Conte o que encontrou nesta OS.', 'assistant')
        self.input.focus_set()

    def destroyed(self, event):
        if event.widget is self.window:
            self.closed = True
            if self._poll_job:
                try:
                    self.window.after_cancel(self._poll_job)
                except tk.TclError:
                    pass


def run() -> None:
    window = tk.Tk()
    try:
        App(window)
        window.mainloop()
    except Exception:
        messagebox.showerror('Não consegui abrir o AEBOT', 'Confira se a pasta resources está completa e corresponde a esta versão. Não há fallback para outro serviço.', parent=window)
        window.destroy()

"""Mostro o contexto em telas largas e a resposta rápida só quando há pergunta."""
import tkinter as tk
from tkinter import ttk
from .case_overview import CaseOverview
from .theme import BG, SURFACE, FG, MUTED, NAVY, BORDER, BLUE, SOFT_BLUE, button


class OverviewPanel:
    def __init__(self, parent):
        self.frame = tk.Frame(parent, bg=SURFACE, highlightthickness=1, highlightbackground=BORDER, width=270)
        self.frame.grid_propagate(False)
        self.frame.columnconfigure(0, weight=1)
        self.frame.rowconfigure(2, weight=1)
        self.title = tk.Label(self.frame, bg=SURFACE, fg=NAVY, font=('Segoe UI', 12, 'bold'), anchor='w')
        self.title.grid(row=0, column=0, sticky='ew', padx=18, pady=(18, 8))
        self.note = tk.Label(self.frame, bg=SURFACE, fg=MUTED, font=('Segoe UI', 9), wraplength=225, justify='left', anchor='w')
        self.note.grid(row=1, column=0, sticky='ew', padx=18, pady=(0, 12))
        self.details = tk.Text(self.frame, bg=SURFACE, fg=FG, relief='flat', bd=0,
            wrap='word', font=('Segoe UI', 10), padx=18, pady=10, cursor='arrow')
        self.details.grid(row=2, column=0, sticky='nsew')
        scroll = ttk.Scrollbar(self.frame, command=self.details.yview)
        scroll.grid(row=2, column=1, sticky='ns')
        self.details.configure(yscrollcommand=scroll.set)
        self.details.tag_configure('heading', foreground=BLUE, font=('Segoe UI', 9, 'bold'), spacing1=12, spacing3=7)
        self.details.tag_configure('body', spacing3=12)
        self.show(CaseOverview('Contexto da OS', 'O resumo aparece depois do primeiro relato.'))

    def show(self, overview):
        self.title.configure(text=overview.title)
        self.note.configure(text=overview.note)
        self.details.configure(state='normal')
        self.details.delete('1.0', 'end')
        for heading, values in [('CONTEXTO INFORMADO', overview.contexts), ('RELATOS CONSIDERADOS', overview.findings),
                                 ('AINDA FALTA CONFIRMAR', (overview.question,) if overview.question else ())]:
            if values:
                self.details.insert('end', heading + '\n', 'heading')
                for value in values:
                    self.details.insert('end', value + '\n', 'body')
        if not overview.contexts and not overview.findings and not overview.question:
            self.details.insert('end', 'Consultas não viram ocorrências.\n\nPara outra OS, use Novo caso.', 'body')
        self.details.configure(state='disabled')


class ContextPrompt:
    def __init__(self, parent, answer):
        self.frame = tk.Frame(parent, bg=SOFT_BLUE, padx=10, pady=5)
        self.frame.columnconfigure(0, weight=1)
        self.callback, self.options = answer, ()
        self.label = tk.Label(self.frame, text='Confirme para continuar', bg=SOFT_BLUE, fg=BLUE, font=('Segoe UI', 9), anchor='w')
        self.label.grid(row=0, column=0, sticky='w')
        self.actions = tk.Frame(self.frame, bg=SOFT_BLUE)
        self.actions.grid(row=0, column=1, sticky='e')
        self.controls = []

    def show(self, overview, busy=False):
        for widget in self.actions.winfo_children():
            widget.destroy()
        self.controls = []
        self.options = overview.answers
        if not self.options or busy:
            self.frame.grid_remove()
            return
        self.label.configure(text='Hipótese · confirme' if overview.title == 'Simulação isolada' else 'Confirme para continuar')
        if len(self.options) <= 2:
            for choice in self.options:
                widget = button(self.actions, choice.label, lambda text=choice.text: self.callback(text))
                widget.configure(font=('Segoe UI', 9), padx=9, pady=5)
                widget.pack(side='left', padx=(5, 0))
                self.controls.append(widget)
        else:
            combo = ttk.Combobox(self.actions, values=[item.label for item in self.options], state='readonly', width=19, font=('Segoe UI', 9))
            combo.pack(side='left', padx=5)
            confirm = button(self.actions, 'Responder', lambda: self.callback(self.options[combo.current()].text) if combo.current() >= 0 else None)
            confirm.configure(padx=8, pady=5, font=('Segoe UI', 9))
            confirm.pack(side='left')
            self.controls.extend([combo, confirm])
        self.frame.grid()

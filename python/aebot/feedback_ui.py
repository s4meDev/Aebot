"""Formulário voluntário e leitura local. Nada é enviado pela internet."""
from pathlib import Path
import sqlite3
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import unicodedata
from .feedback import CATEGORIES, FeedbackStore

from .theme import BG, SURFACE, FG, MUTED


def label(parent, text):
    widget = tk.Label(parent, text=text, bg=BG, fg=FG, font=('Segoe UI', 10), anchor='w', justify='left')
    widget.pack(fill='x', pady=(12, 5))
    return widget


def button(parent, text, action):
    widget = tk.Button(parent, text=text, command=action, bg=SURFACE, fg=FG, relief='flat',
        padx=12, pady=8, font=('Segoe UI', 10))
    widget.pack(side='left', padx=(0, 8))
    return widget


def editor(parent, height):
    widget = tk.Text(parent, height=height, bg=SURFACE, fg=FG, insertbackground=FG,
        wrap='word', font=('Segoe UI', 10), bd=0, padx=10, pady=8)
    widget.pack(fill='both', expand=True)
    return widget


def panel(parent, title, geometry):
    window = tk.Toplevel(parent)
    window.title(title)
    width, height = map(int, geometry.split('x'))
    width = min(width, window.winfo_screenwidth() - 80)
    height = min(height, window.winfo_screenheight() - 110)
    window.geometry(f'{width}x{height}+40+40')
    window.minsize(540, 450)
    window.configure(bg=BG)
    window.transient(parent)
    frame = tk.Frame(window, bg=BG, padx=20, pady=16)
    frame.pack(fill='both', expand=True)
    return window, frame


class FeedbackDialog:
    def __init__(self, parent, store: FeedbackStore, metadata: dict):
        self.store, self.metadata = store, metadata
        self.window, frame = panel(parent, 'AEBOT • Enviar feedback', '620x610')
        self.window.grab_set()
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(6, weight=1)
        frame.rowconfigure(8, weight=1)
        def field_label(text, row, **style):
            widget = tk.Label(frame, text=text, bg=BG, fg=FG, font=('Segoe UI', 10),
                anchor='w', justify='left', **style)
            widget.grid(row=row, column=0, sticky='ew', pady=(8, 5))
            return widget
        field_label('O que posso melhorar?', 0).configure(font=('Segoe UI', 17, 'bold'))
        field_label(metadata['service_name'], 1)
        field_label('Salvo só o formulário e as versões neste PC. O chat não será anexado.\n'
            'Não inclua dados de clientes ou números de OS.', 2, wraplength=520).configure(fg=MUTED)
        field_label('Tipo de feedback', 3)
        self.category = ttk.Combobox(frame, values=CATEGORIES, state='readonly')
        self.category.current(0)
        self.category.grid(row=4, column=0, sticky='ew')
        field_label('Problema ou sugestão (até 6.000 caracteres)', 5)
        self.description = tk.Text(frame, height=5, wrap='word', bg=SURFACE, fg=FG,
            insertbackground=FG, font=('Segoe UI', 10), bd=0, padx=10, pady=8)
        self.description.grid(row=6, column=0, sticky='nsew')
        field_label('Orientação esperada (opcional, até 4.000 caracteres)', 7)
        self.expected = tk.Text(frame, height=3, wrap='word', bg=SURFACE, fg=FG,
            insertbackground=FG, font=('Segoe UI', 10), bd=0, padx=10, pady=8)
        self.expected.grid(row=8, column=0, sticky='nsew')
        row = tk.Frame(frame, bg=BG)
        row.grid(row=9, column=0, sticky='ew', pady=(14, 0))
        self.save_button = button(row, 'Salvar feedback neste PC', self.save)
        self.cancel_button = button(row, 'Cancelar', self.window.destroy)
        self.description.focus_set()

    def save(self):
        try:
            self.store.save(**self.metadata, category=self.category.get(),
                description=self.description.get('1.0', 'end-1c'),
                expected_response=self.expected.get('1.0', 'end-1c'))
        except (ValueError, OSError, sqlite3.Error) as error:
            messagebox.showerror('Feedback não salvo', str(error), parent=self.window)
            return
        messagebox.showinfo('Feedback salvo', 'Salvei neste computador. Em “Feedbacks salvos”, '
            'você pode ler ou exportar para o responsável. Nada foi enviado pela internet.', parent=self.window)
        self.window.destroy()


class FeedbackReader:
    def __init__(self, parent, store: FeedbackStore):
        self.store = store
        self.window, frame = panel(parent, 'AEBOT • Feedbacks salvos', '860x700')
        self.window.minsize(660, 540)
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(4, weight=1)
        frame.rowconfigure(5, weight=1)
        tk.Label(frame, text='Feedbacks salvos', bg=BG, fg=FG,
            font=('Segoe UI', 17, 'bold')).grid(row=0, column=0, sticky='w', pady=(0, 8))
        tk.Label(frame, text='Registros locais. Importe os JSONs dos outros PCs para reunir os relatos.',
            bg=BG, fg=MUTED, font=('Segoe UI', 10), wraplength=600, justify='left').grid(row=1, column=0, sticky='w')
        self.search = tk.StringVar()
        search = tk.Entry(frame, textvariable=self.search, bg=SURFACE, fg=FG, insertbackground=FG,
            relief='flat', font=('Segoe UI', 10))
        search.grid(row=2, column=0, sticky='ew', pady=(12, 4), ipady=8)
        tk.Label(frame, text='Buscar por texto, serviço ou categoria', bg=BG, fg=MUTED,
            font=('Segoe UI', 9)).grid(row=3, column=0, sticky='w', pady=(0, 8))
        table = tk.Frame(frame, bg=BG)
        table.grid(row=4, column=0, sticky='nsew')
        self.tree = ttk.Treeview(table, columns=('date', 'service', 'category'), show='headings', height=5)
        for key, title, width in [('date', 'Data', 145), ('service', 'Serviço', 290), ('category', 'Tipo', 165)]:
            self.tree.heading(key, text=title)
            self.tree.column(key, width=width, minwidth=70)
        scroll = ttk.Scrollbar(table, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side='left', fill='both', expand=True)
        scroll.pack(side='right', fill='y')
        self.tree.bind('<<TreeviewSelect>>', self.selected)
        self.details = tk.Text(frame, height=6, bg=SURFACE, fg=FG, wrap='word',
            font=('Segoe UI', 10), bd=0, padx=12, pady=10, state='disabled')
        self.details.grid(row=5, column=0, sticky='nsew', pady=(10, 0))
        self.count = tk.StringVar()
        tk.Label(frame, textvariable=self.count, bg=BG, fg=MUTED, anchor='w',
            font=('Segoe UI', 9)).grid(row=6, column=0, sticky='ew', pady=6)
        row = tk.Frame(frame, bg=BG)
        row.grid(row=7, column=0, sticky='ew', pady=(8, 0))
        button(row, 'Atualizar', self.refresh)
        self.export_button = button(row, 'Exportar JSON', self.export_file)
        button(row, 'Importar JSON', self.import_file)
        button(row, 'Fechar', self.window.destroy)
        tk.Label(frame, text=str(store.path), bg=BG, fg=MUTED, wraplength=600,
            font=('Segoe UI', 8), justify='left').grid(row=8, column=0, sticky='w', pady=(8, 0))
        self.rows = []
        self.search.trace_add('write', lambda *_: self.render())
        self.refresh()

    def refresh(self):
        try:
            self.rows = self.store.list()
        except (ValueError, OSError, sqlite3.Error) as error:
            messagebox.showerror('Não consegui ler os feedbacks', str(error), parent=self.window)
            return
        self.render()

    def render(self):
        def normalized(value):
            return ''.join(char for char in unicodedata.normalize('NFD', value.casefold()) if not unicodedata.combining(char))
        wanted = normalized(self.search.get())
        visible = [row for row in self.rows if wanted in normalized(' '.join(row.values()))]
        self.tree.delete(*self.tree.get_children())
        for item in visible[:500]:
            self.tree.insert('', 'end', iid=item['id'], values=(item['createdAt'][:16].replace('T', ' ') + ' UTC', item['serviceName'], item['category']))
        self.count.set(f'{min(len(visible), 500)} exibidos • {len(visible)} encontrados • {len(self.rows)} no total. A exportação inclui todos.')
        self.show_details('Selecione um registro para ler o relato e a orientação esperada.')

    def show_details(self, value):
        self.details.configure(state='normal')
        self.details.delete('1.0', 'end')
        self.details.insert('1.0', value)
        self.details.configure(state='disabled')

    def selected(self, _event=None):
        selection = self.tree.selection()
        item = next((row for row in self.rows if selection and row['id'] == selection[0]), None)
        if item:
            self.show_details(f"{item['description']}\n\nOrientação esperada:\n{item['expectedResponse'] or 'Não informada.'}\n\n"
                f"Aplicativo {item['appVersion']} • Base {item['ruleStoreVersion']}\nID: {item['id']}")

    def export_file(self):
        path = filedialog.asksaveasfilename(parent=self.window, title='Exportar todos os feedbacks locais',
            defaultextension='.json', initialfile='AEBOT-feedbacks.json', filetypes=[('Feedback JSON', '*.json')])
        if not path:
            return
        try:
            count = self.store.export_file(Path(path))
        except (ValueError, OSError, sqlite3.Error) as error:
            messagebox.showerror('Não consegui exportar', str(error), parent=self.window)
            return
        messagebox.showinfo('Exportação concluída', f'{count} feedbacks exportados. Compartilhe somente com o responsável; o arquivo contém os relatos escritos no formulário.', parent=self.window)

    def import_file(self):
        path = filedialog.askopenfilename(parent=self.window, title='Importar feedbacks de outro computador', filetypes=[('Feedback JSON', '*.json')])
        if not path:
            return
        try:
            added = self.store.import_file(Path(path))
        except (ValueError, OSError, sqlite3.Error) as error:
            messagebox.showerror('Não consegui importar', str(error), parent=self.window)
            return
        self.refresh()
        messagebox.showinfo('Importação concluída', f'{added} novos registros. Feedbacks já importados não foram duplicados.', parent=self.window)

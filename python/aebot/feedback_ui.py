"""Formulário voluntário e leitura local. Nada é enviado pela internet."""
from pathlib import Path
import sqlite3
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import unicodedata
from .feedback import CATEGORIES, FeedbackStore

BG, SURFACE, FG, MUTED = '#101113', '#22252a', '#eeeeef', '#b4b8c2'


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
    window.geometry(geometry)
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
        label(frame, 'O que posso melhorar?').configure(font=('Segoe UI', 16, 'bold'))
        label(frame, metadata['service_name'])
        label(frame, 'Só o formulário e as versões do aplicativo/base serão salvos neste PC.\n'
            'O chat não será anexado. Não inclua dados de clientes ou números de OS.').configure(fg=MUTED)
        label(frame, 'Tipo de feedback')
        self.category = ttk.Combobox(frame, values=CATEGORIES, state='readonly')
        self.category.current(0)
        self.category.pack(fill='x')
        label(frame, 'Descreva o problema ou a sugestão (até 6.000 caracteres)')
        self.description = editor(frame, 6)
        label(frame, 'Qual seria a orientação correta? (opcional, até 4.000 caracteres)')
        self.expected = editor(frame, 4)
        row = tk.Frame(frame, bg=BG)
        row.pack(fill='x', pady=(16, 0))
        button(row, 'Salvar feedback neste PC', self.save)
        button(row, 'Cancelar', self.window.destroy)
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
        label(frame, 'Feedbacks salvos').configure(font=('Segoe UI', 16, 'bold'))
        label(frame, 'Estes registros são locais. Para reunir os de outros PCs, importe os JSONs exportados por eles.').configure(fg=MUTED, wraplength=780)
        self.search = tk.StringVar()
        search = tk.Entry(frame, textvariable=self.search, bg=SURFACE, fg=FG, insertbackground=FG,
            relief='flat', font=('Segoe UI', 10))
        search.pack(fill='x', pady=(10, 5), ipady=8)
        self.search.trace_add('write', lambda *_: self.render())
        label(frame, 'Buscar por texto, serviço ou categoria')
        table = tk.Frame(frame, bg=BG)
        table.pack(fill='both', expand=True)
        self.tree = ttk.Treeview(table, columns=('date', 'service', 'category'), show='headings', height=7)
        for key, title, width in [('date', 'Data', 155), ('service', 'Serviço', 300), ('category', 'Tipo', 180)]:
            self.tree.heading(key, text=title)
            self.tree.column(key, width=width, minwidth=80)
        scroll = ttk.Scrollbar(table, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side='left', fill='both', expand=True)
        scroll.pack(side='right', fill='y')
        self.tree.bind('<<TreeviewSelect>>', self.selected)
        self.details = editor(frame, 9)
        self.details.configure(state='disabled')
        self.count = tk.StringVar()
        tk.Label(frame, textvariable=self.count, bg=BG, fg=MUTED, anchor='w').pack(fill='x', pady=6)
        row = tk.Frame(frame, bg=BG)
        row.pack(fill='x', pady=(8, 0))
        button(row, 'Atualizar', self.refresh)
        button(row, 'Exportar JSON', self.export_file)
        button(row, 'Importar JSON', self.import_file)
        button(row, 'Fechar', self.window.destroy)
        label(frame, str(store.path)).configure(fg=MUTED, wraplength=780, font=('Segoe UI', 8))
        self.rows = []
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

"""Mostro a própria base em linguagem de manutenção. Não mantenho outra lista de regras."""
from collections import defaultdict
import tkinter as tk
from tkinter import ttk, messagebox
import sys
import webbrowser
from .runtime import resources_root
from .theme import BG, SURFACE, FG, MUTED, NAVY, BORDER, button

SCOPES = {'current': 'OS atual', 'origin': 'OS de origem', 'executed': 'Adicional Executado'}


def rule_details(store, rule):
    """Esta mesma descrição alimenta a tela e o guia gerado do catálogo."""
    meta = rule.get('evaluation', {})
    contexts = {item['id']: item for item in store.data.get('interpretation', {}).get('contexts', [])}
    lines = [f"{rule['id']} | {rule['title']}", '', rule['description'], '',
        'CONCLUSÃO: ' + rule.get('severity', 'Orientação, sem conclusão oficial'),
        'ONDE SE APLICA: ' + SCOPES.get(meta.get('scope'), 'Conforme o serviço selecionado')]
    for dimension, values in meta.get('requires', {}).items():
        definition = contexts[dimension]
        names = [item['label'] for item in definition['values'] if item['id'] in values]
        lines.append('CONFIRMAR: ' + ' ou '.join(names))
    for condition in rule.get('mandatoryConditions', []):
        lines.append('CONFIRMAR: ' + condition)
    for group in rule.get('mandatoryConditionGroups', []):
        lines.append('CONFIRMAR: ' + group['label'] + ' (' + ' ou '.join(group['expressions']) + ')')
    for dimension, values in meta.get('incompatible', {}).items():
        names = [item['label'] for item in contexts[dimension]['values'] if item['id'] in values]
        lines.append('NÃO APLICAR NESTE CONTEXTO: ' + ' ou '.join(names))
    for exception in rule.get('exceptions', []):
        lines.append('EXCEÇÃO A CONFERIR NO RELATO: ' + exception)
    policy = rule.get('matchPolicy', {}).get('minimumMatchedFactGroups')
    if policy:
        names = [item['title'] for item in store.rules if item.get('factGroup') in policy['groups']]
        lines.append(f"COMBINAÇÃO: exige {policy['count']} fatos independentes entre: " + '; '.join(names))
    if meta.get('ask'):
        lines.append('SE FALTAR CONTEXTO, PERGUNTAR: ' + contexts[meta['ask']]['question'])
    for question in rule.get('missingInformation', []):
        lines.append('INFORMAÇÃO IMPORTANTE: ' + question)
    lines.extend(['', 'ORIENTAÇÃO: ' + rule.get('guidance', rule['message'])])
    if rule.get('examples'):
        lines.extend(['', 'EXEMPLOS: ' + '; '.join(rule['examples'])])
    if rule.get('sourceReferences'):
        lines.extend(['', 'BASE INFORMADA: ' + '; '.join(rule['sourceReferences'])])
    return '\n'.join(lines)


def grouped_rules(store, service_id):
    groups = defaultdict(list)
    for rule in store.for_service(service_id):
        groups[rule.get('category', 'Outras orientações')].append(rule)
    return dict(sorted(groups.items()))


class RulebookReader:
    def __init__(self, parent, store, service_id):
        self.store, self.service_id = store, service_id
        self.window = tk.Toplevel(parent)
        self.window.title('AEBOT | Regras e fluxo de análise')
        self.window.geometry('960x660')
        self.window.minsize(680, 480)
        self.window.configure(bg=BG)
        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(2, weight=1)
        tk.Label(self.window, text='Regras e fluxo de análise', bg=BG, fg=NAVY,
            font=('Segoe UI', 18, 'bold')).grid(row=0, column=0, sticky='w', padx=20, pady=(16, 4))
        tk.Label(self.window, text=f"{store.services[service_id]['name']} · Base {store.version}",
            bg=BG, fg=MUTED, font=('Segoe UI', 10)).grid(row=1, column=0, sticky='w', padx=20, pady=(0, 12))
        pane = tk.PanedWindow(self.window, orient='horizontal', bg=BORDER, sashwidth=5, bd=0)
        pane.grid(row=2, column=0, sticky='nsew', padx=20)
        left = tk.Frame(pane, bg=SURFACE)
        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)
        pane.add(left, width=300, minsize=220)
        self.search = tk.StringVar()
        self.entry = tk.Entry(left, textvariable=self.search, font=('Segoe UI', 10), bg=SURFACE, fg=FG,
            relief='flat', highlightthickness=1, highlightbackground=BORDER)
        self.entry.grid(row=0, column=0, sticky='ew', padx=10, pady=10, ipady=8)
        self.tree = ttk.Treeview(left, show='tree', selectmode='browse')
        self.tree.grid(row=1, column=0, sticky='nsew')
        scroll = ttk.Scrollbar(left, orient='vertical', command=self.tree.yview)
        scroll.grid(row=1, column=1, sticky='ns')
        self.tree.configure(yscrollcommand=scroll.set)
        right = tk.Frame(pane, bg=SURFACE)
        right.columnconfigure(0, weight=1)
        right.rowconfigure(0, weight=1)
        pane.add(right, minsize=300)
        self.details = tk.Text(right, bg=SURFACE, fg=FG, wrap='word', state='disabled', bd=0,
            font=('Segoe UI', 10), padx=18, pady=16, highlightthickness=0)
        self.details.grid(row=0, column=0, sticky='nsew')
        details_scroll = ttk.Scrollbar(right, orient='vertical', command=self.details.yview)
        details_scroll.grid(row=0, column=1, sticky='ns')
        self.details.configure(yscrollcommand=details_scroll.set)
        footer = tk.Frame(self.window, bg=BG)
        footer.grid(row=3, column=0, sticky='ew', padx=20, pady=12)
        button(footer, 'Ver fluxo geral', self.show_flow).pack(side='left')
        button(footer, 'Abrir diagrama', self.open_diagram).pack(side='left', padx=8)
        button(footer, 'Fechar', self.window.destroy).pack(side='right')
        self.rules = {rule['id']: rule for rule in store.for_service(service_id)}
        self.search.trace_add('write', lambda *_: self.render())
        self.tree.bind('<<TreeviewSelect>>', self.selected)
        self.render()
        self.show_flow()

    def show(self, text):
        self.details.configure(state='normal')
        self.details.delete('1.0', 'end')
        self.details.insert('1.0', text)
        self.details.configure(state='disabled')

    def show_flow(self):
        self.show('COMO A ANÁLISE FUNCIONA\n\n'
            '1. Serviço e intenção\nSeparo uma dúvida ou hipótese de um relato sobre a OS.\n\n'
            '2. Fatos e contexto\nConfiro o que foi afirmado, a etapa, a equipe, a frente e se o relato é da OS atual, da origem ou do adicional. Retificações substituem o dado antigo no mesmo escopo.\n\n'
            '3. Regras aplicáveis\nA IA relaciona o texto à base. Condições e exceções precisam estar sustentadas pelo relato. Se um detalhe muda a orientação, faço uma pergunta.\n\n'
            '4. Combinação e conclusão\nReúno os fatos confirmados e resolvo os conflitos pela política do serviço. Não aprovo por falta de regra.\n\n'
            '5. Orientação ao analista\nMostro a conclusão quando sustentada, as regras consultadas e a ação prevista. Quando a base não permite concluir, a orientação fica condicional.\n\n'
            'Selecione uma regra à esquerda para conferir as condições e exceções reais da base. Esta tela não altera regras ou treina o modelo.')

    def open_diagram(self):
        root = resources_root()
        path = root.parent / 'FLUXO-ASFALTO.html' if getattr(sys, 'frozen', False) else root / 'docs/FLUXO-ASFALTO.html'
        if not path.is_file():
            messagebox.showerror('Diagrama indisponível', 'O guia não veio nesta pasta. Confira se a entrega foi extraída inteira.', parent=self.window)
            return
        # É uma página local, sem scripts, fontes remotas ou consulta à rede.
        webbrowser.open(path.resolve().as_uri())

    def render(self):
        wanted = self.store.text.normalize(self.search.get())
        self.tree.delete(*self.tree.get_children())
        for index, (category, rules) in enumerate(grouped_rules(self.store, self.service_id).items()):
            visible = [rule for rule in rules if wanted in self.store.text.normalize(rule_details(self.store, rule))]
            if not visible:
                continue
            parent = self.tree.insert('', 'end', iid=f'category-{index}', text=category, open=True)
            for rule in visible:
                self.tree.insert(parent, 'end', iid=rule['id'], text=rule['title'])

    def selected(self, _event=None):
        selection = self.tree.selection()
        if selection and selection[0] in self.rules:
            self.show(rule_details(self.store, self.rules[selection[0]]))

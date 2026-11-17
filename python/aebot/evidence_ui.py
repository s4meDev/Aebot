"""Abro os fundamentos em memória, sem gravar o relato ou copiar para feedback."""
import tkinter as tk
from tkinter import ttk
from .contracts import Evaluation
from .theme import BG, SURFACE, FG, MUTED, NAVY, BORDER, button


def evaluation_details(result: Evaluation) -> str:
    labels = {'fact': 'Fato relatado', 'consultation': 'Regra consultada, não é ocorrência',
        'scenario': 'Hipótese, não classifica a OS real'}
    lines = [result.content, '', 'COMO CHEGUEI À ORIENTAÇÃO',
        'Base: ' + result.ruleStoreVersion,
        'Conclusão oficial: ' + (result.decision or 'Sem decisão oficial'),
        'A confiança técnica indica a qualidade do matching, não uma taxa de acerto.']
    if result.pendingInformation:
        lines.extend(['', 'AINDA FALTA CONFIRMAR', *result.pendingInformation])
    inactive = list(dict.fromkeys(item['source']['quote'] for item in result.observations if not item['active']))
    if inactive:
        lines.extend(['', 'PONTOS QUE NÃO CONFIRMARAM UMA FALHA'])
        lines.extend('Trecho: “' + quote + '”. Não foi usado para classificar.' for quote in inactive)
    for match in result.matchedRules:
        lines.extend(['', match.id + ' — ' + match.title,
            labels[match.application], 'Trecho: “' + match.sourceQuote + '”'])
        lines.extend('Contexto do trecho: “' + quote + '”' for quote in match.contextQuotes)
        lines.extend('Verificação: ' + reason for reason in match.reasons)
        if match.guidance:
            lines.append('Orientação: ' + match.guidance)
        if match.supportingRuleIds:
            lines.append('Combinação de: ' + ', '.join(match.supportingRuleIds))
    return '\n'.join(lines)


class EvidenceReader:
    def __init__(self, parent, result: Evaluation):
        self.window = tk.Toplevel(parent)
        self.window.title('AEBOT | Fundamentos da resposta')
        self.window.geometry('760x620')
        self.window.minsize(540, 400)
        self.window.configure(bg=BG)
        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(2, weight=1)
        tk.Label(self.window, text='Fundamentos da resposta', bg=BG, fg=NAVY,
            font=('Segoe UI', 18, 'bold')).grid(row=0, column=0, sticky='w', padx=22, pady=(18, 4))
        tk.Label(self.window, text='Só nesta janela · não salvo o conteúdo da conversa', bg=BG, fg=MUTED,
            font=('Segoe UI', 10)).grid(row=1, column=0, sticky='w', padx=22, pady=(0, 14))
        frame = tk.Frame(self.window, bg=SURFACE, highlightthickness=1, highlightbackground=BORDER)
        frame.grid(row=2, column=0, sticky='nsew', padx=22)
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(0, weight=1)
        self.details = tk.Text(frame, wrap='word', bg=SURFACE, fg=FG, bd=0,
            highlightthickness=0, font=('Segoe UI', 11), padx=18, pady=16)
        self.details.grid(row=0, column=0, sticky='nsew')
        scroll = ttk.Scrollbar(frame, orient='vertical', command=self.details.yview)
        scroll.grid(row=0, column=1, sticky='ns')
        self.details.configure(yscrollcommand=scroll.set)
        self.details.insert('1.0', evaluation_details(result))
        self.details.configure(state='disabled')
        button(self.window, 'Fechar', self.window.destroy).grid(row=3, column=0,
            sticky='e', padx=22, pady=14)

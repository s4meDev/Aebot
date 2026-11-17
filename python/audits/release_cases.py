"""Conferência nova para entrega: incerteza não é vínculo confirmado.

Escrevi os resultados esperados antes da rodada real. As regras antigas e
seus gabaritos continuam preservados; estes são cenários sintéticos adicionais.
"""
from .asphalt_cases import INTERNAL, CONTRACTOR, B, D, COMBO


def cases(store):
    rows = []
    for index, teams in enumerate(('interna e terceirizada', 'interna, terceirizada',
                                   'terceirizada e interna', 'interna/terceirizada')):
        rows.append(dict(name=f'dois vínculos sem escolha {index}',
            turns=['Sem aferição da vala. Equipe ' + teams + '.'], expectedDecision=None,
            expectedRules=[], pendingRequired=True, pendingContains='interna ou terceirizada'))
    for index, uncertainty in enumerate(('Não sei se é interna.', 'Não tenho certeza se é interna.',
                                       'Ainda preciso confirmar se é interna.', 'Acho que é interna.',
                                       'Pode ser interna.', 'Parece que é terceirizada.',
                                       'Provavelmente é interna.')):
        rows.append(dict(name=f'equipe ainda não confirmada {index}',
            turns=['Sem aferição da vala.', uncertainty], expectedDecision=None,
            expectedRules=[], pendingRequired=True, pendingContains='interna ou terceirizada'))
        rows.append(dict(name=f'certeza anterior retirada {index}',
            turns=['Sem aferição da vala. Equipe interna.', 'Corrigindo: ' + uncertainty],
            expectedDecision=None, expectedRules=[], pendingRequired=True))
        rows.append(dict(name=f'esclarecimento após incerteza {index}',
            turns=['Sem aferição da vala. Equipe interna.', 'Corrigindo: ' + uncertainty, 'terceirizada'],
            expectedDecision='Reprovado', expectedRules=[CONTRACTOR], pendingRequired=False))
    rows += [
        dict(name='escolha após dois vínculos', turns=['Sem aferição da vala. Equipe interna e terceirizada.', 'interna'],
            expectedDecision='Não Conforme', expectedRules=[INTERNAL], pendingRequired=False),
        dict(name='frentes conflitantes não escolhem VCG', turns=['OS de origem sem aferição. Frente VCG e Manutenção.'],
            expectedDecision=None, expectedRules=[], pendingRequired=True, pendingContains='frente'),
        dict(name='frente confirmada após conflito',
            turns=['OS de origem sem aferição. Frente VCG e Manutenção.', 'VCG'],
            expectedDecision=None, expectedRules=[], pendingRequired=False,
            requiredAnyRules=['RULE-ASF-ORIGEM-VCG-01']),
        dict(name='incerteza de hipótese não muda OS real',
            turns=['Sem foto antes.', 'Se faltar aferição da vala com equipe interna e terceirizada?',
                   'interna', 'Voltando ao caso real: e sem foto durante.'],
            expectedDecision='Reprovado', expectedRules=[B, D, COMBO], pendingRequired=False),
        dict(name='nova OS descarta conflito', turns=['Sem aferição da vala. Equipe interna e terceirizada.', 'Outra OS: sem foto antes.'],
            expectedDecision='Não Conforme', expectedRules=[B], pendingRequired=False),
        dict(name='incerteza da ocorrência pede confirmação', turns=['Talvez falte foto depois.'],
            expectedDecision=None, expectedRules=[], pendingRequired=True),
    ]
    return [dict(row, name=row['name'] + ' / ' + service, serviceId=service,
        category='Prontidão de contexto 0.6.3') for service in store.services for row in rows]

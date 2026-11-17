"""Gabarito novo de consultas compostas e continuação, sem mudar o anterior."""
from .asphalt_cases import B, D, A, COMBO, INTERNAL, CONTRACTOR, ORIGIN, VCG, DUP


def cases(store):
    form = 'RULE-ASF-FORMULARIO-01'
    scenarios = [
        ('antes e depois', ['Qual é a regra da foto antes e da foto depois?'], None, [B, A], {}),
        ('retomada de foto na consulta', ['Qual a regra da foto antes e depois?'], None, [B, A], {}),
        ('comparar durante e depois', ['Qual a diferença entre foto durante e foto depois?'], None, [D, A], {}),
        ('formulário e duplicidade', ['Qual a regra do formulário e da duplicidade?'], None, [form, DUP], {}),
        ('excluir assunto', ['Qual a regra de foto depois, não de antes?'], None, [A], {}),
        ('dois assuntos e vínculos condicionais', ['Me explique a falta de aferição e o formulário errado.'], None, [INTERNAL, CONTRACTOR, form], {}),
        ('comparar atual e origem', ['Qual é a regra da falta de aferição no serviço atual e na OS de origem?'], None, [INTERNAL, CONTRACTOR, ORIGIN], {'requiredAnyRules': [VCG]}),
        ('outro objeto não vira foto', ['Qual a regra da foto antes e da sinalização?'], None, [B, 'RULE-ASF-EHS-01'], {}),
        ('falta consultada não vira ocorrência', ['Qual a regra quando não há foto antes?'], None, [B], {}),
        ('consulta preserva devolutiva', ['Sem aferição da vala.', 'Qual a regra da foto antes e depois?', 'interna'], 'Não Conforme', [INTERNAL], {'contextApplied': True}),
        ('consulta não contamina fatos', ['Sem foto antes.', 'Qual a regra do formulário e da duplicidade?', 'E sem foto durante.'], 'Reprovado', [B, D, COMBO], {'contextApplied': True}),
        ('resposta curta também contém fato', ['Sem aferição da vala.', 'interna e formulário preenchido incorretamente.'], 'Não Conforme', [INTERNAL, form], {'contextApplied': True}),
        ('hipótese conserva base do caso após consulta', ['Sem foto antes.', 'Se faltar aferição?', 'Qual a regra da foto antes e depois?', 'interna'], None, [INTERNAL, B], {'expectedScenario': 'Não Conforme'}),
        ('pergunta composta com assunto desconhecido', ['Qual a regra do formulário e do almoço da equipe?'], None, [form], {'pendingRequired': True, 'pendingContains': 'almoco'}),
        ('nova OS limpa os fatos', ['Sem foto depois.', 'Novo caso: formulário preenchido incorretamente.'], 'Não Conforme', [form], {'contextApplied': False}),
        ('retificação depois da consulta composta', ['Sem aferição da vala. Equipe terceirizada.', 'Qual a regra do formulário e da duplicidade?', 'Corrigindo: equipe interna.'], 'Não Conforme', [INTERNAL], {}),
        ('comparação de etapas não inventa a combinação', ['Qual a regra da foto antes e da foto durante?'], None, [B, D], {}),
        ('negação da falta sem aprovação', ['Não está sem foto depois.', 'Qual a regra do formulário e da duplicidade?'], None, [form, DUP], {}),
        ('esclarecer consulta sem criar uma falha', ['Sem aferição da vala.', 'Qual a regra do formulário e do almoço da equipe?', 'Quis dizer: foto depois.'], None, [A], {'expectedIntent': 'question'}),
        ('retomar OS depois de esclarecer consulta', ['Sem aferição da vala.', 'Qual a regra do formulário e do almoço da equipe?', 'Quis dizer: foto depois.', 'interna'], 'Não Conforme', [INTERNAL], {}),
        ('outro relato não responde consulta', ['Sem foto antes.', 'Qual a regra do formulário e do almoço da equipe?', 'E sem foto durante.'], 'Reprovado', [B, D, COMBO], {}),
    ]
    rows = []
    for service in store.services:
        for name, turns, decision, rules, extra in scenarios:
            rows.append(dict(name=name + ' / ' + service, category='Consultas compostas e usabilidade 0.9.0',
                serviceId=service, turns=turns, expectedDecision=decision, expectedRules=rules,
                **({'pendingRequired': False} | extra)))
    return rows

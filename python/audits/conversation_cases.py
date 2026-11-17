"""Regressões de roteamento: o assunto atual não pode virar fato de outro turno."""
from .asphalt_cases import B, D, A, COMBO, INTERNAL, CONTRACTOR


def cases(store):
    scenarios = [
        dict(name='consulta com conectivo muda só o assunto', turns=['Sem foto antes.', 'E qual é a regra da foto depois?'],
            expectedDecision=None, expectedRules=[A], expectedIntent='question', pendingRequired=False, contextApplied=False),
        dict(name='consulta não responde equipe da OS', turns=['Sem aferição da vala.', 'E me explique a regra da foto depois.'],
            expectedDecision=None, expectedRules=[A], expectedIntent='question', pendingRequired=False),
        dict(name='resposta curta retoma pendência real após consulta',
            turns=['Sem aferição da vala.', 'E me explique a regra da foto depois.', 'interna'],
            expectedDecision='Não Conforme', expectedRules=[INTERNAL], pendingRequired=False),
        dict(name='consulta não é confirmação da hipótese',
            turns=['Sem foto antes.', 'Mas se faltar aferição da vala?', 'Me explique a regra da foto depois.'],
            expectedDecision=None, expectedRules=[A], expectedIntent='question', pendingRequired=False),
        dict(name='resposta curta retoma hipótese após consulta',
            turns=['Sem foto antes.', 'Mas se faltar aferição da vala?', 'Me explique a regra da foto depois.', 'interna'],
            expectedDecision=None, expectedScenario='Não Conforme', expectedRules=[B, INTERNAL],
            expectedIntent='hypothesis', pendingRequired=False),
        dict(name='retomar caso real não herda falta de aferição hipotética',
            turns=['Sem foto antes.', 'Mas se faltar aferição da vala?', 'Voltando ao caso real: sem foto durante.'],
            expectedDecision='Reprovado', expectedRules=[B, D, COMBO], expectedIntent='report', pendingRequired=False),
        dict(name='consulta comparativa não escolhe equipe para hipótese',
            turns=['Se faltar aferição da vala?', 'Me explique a diferença entre interna e terceirizada na falta de aferição.'],
            expectedDecision=None, expectedRules=[INTERNAL, CONTRACTOR], expectedIntent='question', pendingRequired=False),
        dict(name='confirmação com fato adicional continua uma hipótese',
            turns=['Se faltar aferição da vala?', 'interna e sem foto depois'],
            expectedDecision=None, expectedScenario='Reprovado', expectedRules=[INTERNAL, A], pendingRequired=False),
        dict(name='consulta mantém o ponto ambíguo real até retificação',
            turns=['Não registraram uma coisa que não sei explicar.', 'E qual é a regra da foto antes?', 'Quis dizer: sem foto depois.'],
            expectedDecision='Reprovado', expectedRules=[A], pendingRequired=False),
    ]
    return [dict(item, name=item['name'] + ' / ' + service, serviceId=service,
        category='Isolamento de conversa 0.6.1') for service in store.services for item in scenarios]

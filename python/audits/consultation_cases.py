"""Dúvidas condicionais e retomadas, sempre com modelo real na auditoria."""


def cases(store):
    scenarios = [
        ('equipes na consulta', ['Me explique a falta de aferição.'], None, None,
            ['equipe interna', 'equipe terceirizada', 'Retrabalho']),
        ('comparar equipes não escolhe a última', ['Qual a diferença na falta de aferição entre equipe interna e terceirizada?'], None, None,
            ['equipe interna', 'equipe terceirizada']),
        ('consulta por paráfrase', ['Quero entender o desfecho que ninguém deixou ver.'], None, None, []),
        ('hipótese com esclarecimento', ['Se faltar aferição da vala?', 'interna'], None, 'Não Conforme', ['Retrabalho']),
        ('hipótese não muda OS', ['Equipe interna sem aferição da vala.', 'Mas se faltar foto depois?', 'E formulário preenchido incorretamente.'], 'Não Conforme', None, []),
        ('hipótese depois de OS', ['Equipe interna sem aferição da vala.', 'Mas se faltar foto depois?'], None, 'Reprovado', []),
        ('retomar após pergunta', ['Sem foto antes.', 'E qual é a regra da foto depois?'], None, None, []),
    ]
    result = []
    for service in store.services:
        for name, turns, decision, scenario, phrases in scenarios:
            case = dict(name=name + ' / ' + service, category='Consulta e hipótese isolada',
                turns=turns, serviceId=service, expectedDecision=decision, expectedRules=None,
                pendingRequired=False, contentContains=phrases)
            if scenario:
                case['expectedScenario'] = scenario
            if name == 'consulta por paráfrase':
                # Precisa consultar a regra, não apenas devolver um null técnico.
                case['requiredAnyRules'] = ['RULE-ASF-FOTO-DEPOIS-01']
            result.append(case)
    return result

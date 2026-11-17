"""Casos novos de negação, escolha incerta e retomada de evidência por etapa."""
from .asphalt_cases import B, D, A, INTERNAL, CONTRACTOR


def cases(store):
    rows = []
    for index, query in enumerate([
        'Não está sem foto depois.', 'Não estou sem a foto depois.', 'Não ficou sem foto depois.',
        'Não ficaram sem foto depois.', 'Não faltam fotos depois.', 'Não estavam faltando fotos depois.',
    ]):
        rows.append(dict(name=f'negação de falta {index}', turns=[query], expectedDecision=None,
            expectedRules=[], pendingRequired=False, contentContains=['não está descrito como uma falha']))
    for index, teams in enumerate(['interna ou terceirizada', 'interna/terceirizada', 'terceirizada ou interna']):
        rows.append(dict(name=f'alternativa de equipe {index}',
            turns=['Sem aferição da vala. A equipe é ' + teams + '.'], expectedDecision=None,
            expectedRules=[], pendingRequired=True, pendingContains='interna ou terceirizada'))
    for index, team in enumerate(['Não é uma equipe própria.', 'Nem interna.', 'Nem é terceirizada.']):
        rows.append(dict(name=f'equipe negada {index}', turns=['Sem aferição da vala. ' + team],
            expectedDecision=None, expectedRules=[], pendingRequired=True))
    rows += [
        dict(name='negação não cancela outra falta', turns=['Não está sem foto depois. Sem foto antes.'],
            expectedDecision='Não Conforme', expectedRules=[B], pendingRequired=False),
        dict(name='retificação negativa mantém formulário',
            turns=['Sem foto depois. Formulário preenchido incorretamente.', 'Corrigindo: não está sem foto depois.'],
            expectedDecision='Não Conforme', expectedRules=['RULE-ASF-FORMULARIO-01'], pendingRequired=False),
        dict(name='incerteza suspende equipe antiga',
            turns=['Equipe interna sem aferição da vala.', 'Corrigindo: pode ser interna ou terceirizada.'],
            expectedDecision=None, expectedRules=[], pendingRequired=True),
        dict(name='incerteza e resposta curta terceira',
            turns=['Equipe interna sem aferição da vala.', 'Corrigindo: pode ser interna ou terceirizada.', 'terceirizada'],
            expectedDecision='Reprovado', expectedRules=[CONTRACTOR], pendingRequired=False),
        dict(name='afirmação resolve escolha na mesma mensagem',
            turns=['Sem aferição da vala. Equipe interna ou terceirizada. Corrigindo: equipe interna.'],
            expectedDecision='Não Conforme', expectedRules=[INTERNAL], pendingRequired=False),
        dict(name='negação de equipe confirma a outra somente se afirmada',
            turns=['Sem aferição da vala. Não é interna, é terceirizada.'],
            expectedDecision='Reprovado', expectedRules=[CONTRACTOR], pendingRequired=False),
        dict(name='vídeo é evidência cadastrada', turns=['Tem vídeo durante, só falta antes.'],
            expectedDecision='Não Conforme', expectedRules=[B], pendingRequired=False),
        dict(name='vídeo não transforma sinalização em foto', turns=['Tem vídeo durante, sem sinalização.'],
            expectedDecision='Não Conforme', expectedRules=['RULE-ASF-EHS-01'], pendingRequired=False),
        dict(name='não só reforça duas ausências', turns=['Não só faltou foto antes como também foto depois.'],
            expectedDecision='Reprovado', expectedRules=[B, A], pendingRequired=False),
        dict(name='ênfase não é negação', turns=['Não só faltou foto depois.'],
            expectedDecision='Reprovado', expectedRules=[A], pendingRequired=False),
        dict(name='falta real continua falta', turns=['Não tem foto depois.'],
            expectedDecision='Reprovado', expectedRules=[A], pendingRequired=False),
        dict(name='hipótese com alternativa continua hipótese',
            turns=['Se faltar aferição da vala?', 'interna ou terceirizada'],
            expectedDecision=None, expectedRules=[], expectedIntent='hypothesis', pendingRequired=True),
        dict(name='nenhuma foto retoma substantivo literal',
            turns=['Tem vídeo antes, mas nenhum durante.'],
            expectedDecision='Não Conforme', expectedRules=[D], pendingRequired=False),
        dict(name='negativa de contexto permite esclarecimento posterior',
            turns=['Sem aferição da vala. Nem interna.', 'terceirizada'],
            expectedDecision='Reprovado', expectedRules=[CONTRACTOR], pendingRequired=False),
        dict(name='negar equipe antiga suspende o valor',
            turns=['Equipe interna sem aferição da vala.', 'Corrigindo: não é uma equipe própria.'],
            expectedDecision=None, expectedRules=[], pendingRequired=True),
        dict(name='esclarecer equipe após negar a antiga',
            turns=['Equipe interna sem aferição da vala.', 'Corrigindo: não é uma equipe própria.', 'terceirizada'],
            expectedDecision='Reprovado', expectedRules=[CONTRACTOR], pendingRequired=False),
    ]
    return [dict(row, name=row['name'] + ' / ' + service, serviceId=service,
        category='Segurança linguística 0.6.2') for service in store.services for row in rows]

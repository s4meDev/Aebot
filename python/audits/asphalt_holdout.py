"""Casos adicionais de controle, separados dos usados para ajustar o fluxo."""
from .asphalt_cases import case, B, D, A, INTERNAL, CONTRACTOR, VCG


def cases():
    category = 'Controles independentes de conversa e segurança'
    rows = [
        ('duas ausências negadas', 'Não houve falta de foto antes; não é verdade que faltou foto depois.', None, []),
        ('fato confirmado após negativa', 'Não faltou foto depois, mas sem foto durante.', 'Não Conforme', [D]),
        ('ainda precisa conferir foto', 'Não posso afirmar que faltou foto depois.', None, []),
        ('falta inicial após foto presente', 'Tem foto durante; sem foto antes.', 'Não Conforme', [B]),
        ('falta final com equipe informada', 'Equipe interna. Sem foto depois.', 'Reprovado', [A]),
        ('equipes separadas', 'Equipe interna sem aferição do serviço atual. Equipe terceirizada sem aferição no adicional executado.',
         None, [INTERNAL]),
        ('clareamento após desconhecimento', ['Sem aferição da vala.', 'não sei informar', 'interna'], 'Não Conforme', [INTERNAL]),
        ('correção preserva falta final', ['Equipe terceirizada sem aferição da vala. Sem foto depois.', 'Corrigindo: é interna.'],
         'Reprovado', [INTERNAL, A]),
        ('origem VCG e atual terceira', 'Frente VCG. Sem aferição na OS de origem. Equipe terceirizada sem aferição do serviço atual.',
         'Reprovado', [CONTRACTOR]),
        ('origem presente não apaga adicional', 'A aferição da OS de origem foi apresentada. Equipe interna sem aferição no adicional executado.',
         None, []),
        ('novo caso apaga equipe anterior', ['Equipe terceirizada sem aferição da vala.', 'Novo caso: sem aferição da vala.'], None, []),
        ('hipótese não decide OS', 'Se faltar foto depois, o que acontece?', None, [A]),
    ]
    output = []
    for name, query, decision, rules in rows:
        checks = {'expectedScenario': 'Reprovado'} if name == 'hipótese não decide OS' else {}
        if name == 'novo caso apaga equipe anterior':
            checks['pendingContains'] = 'equipe'
        output.append(case(name, category, query, decision, rules, **checks))
    return output

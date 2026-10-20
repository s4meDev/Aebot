"""Amostra separada de aceitação, escrita após congelar o motor 0.3.0.

Não altero a resposta esperada depois de ver a saída. Os relatos são sintéticos;
isso mede esta amostra, não toda a linguagem dos analistas.
"""
from .asphalt_cases import case, B, D, A, COMBO, INTERNAL, CONTRACTOR, MEASURE


def cases():
    rows = []
    def add(name, query, decision, rules, category='Aceitação informal separada', **checks):
        rows.append(case(name, category, query, decision, rules, **checks))
    add('trabalho sem imagem', 'a turma asfaltou, mas não fotografou o pessoal enquanto aplicava o material', 'Não Conforme', [D])
    add('resultado ausente informal', 'já finalizaram a recomposição só que não enviaram o registro do resultado final', 'Reprovado', [A])
    add('inicial ausente informal', 'ninguém mostrou em foto a condição inicial do trecho', 'Não Conforme', [B])
    add('medida comparada', 'no formulário lançaram 9 m², mas pelas imagens a área executada é menor', 'Não Conforme', [MEASURE])
    add('acabamento com defeito', 'o asfalto entregue ficou mal acabado e desnivelado', 'Reprovado', ['RULE-ASF-ACABAMENTO-01'])
    add('esqueceram etapa', 'esqueceram de anexar as imagens da execução em andamento', 'Não Conforme', [D])
    add('ausência inicial com final', 'não enviaram registro do começo. Tem foto do pavimento pronto.', 'Não Conforme', [B])
    add('comparação coerente', 'a medida real confere com a metragem que lançaram no formulário', None, [])
    add('legenda não é ausência', 'a foto depois existe, mas está sem legenda', None, [])
    add('antes não é acabamento entregue', 'na chegada o asfalto estava mal acabado. Depois ficou adequado.', None, [])
    add('equipe depois da pergunta', ['sem aferição da vala', 'equipe própria'], 'Não Conforme', [INTERNAL],
        category='Aceitação complexa separada', contextApplied=True, contentContains=['retrabalho'])
    add('terceira depois da pergunta', ['sem aferição da vala', 'contratada'], 'Reprovado', [CONTRACTOR],
        category='Aceitação complexa separada', contextApplied=True)
    add('retificação de duas etapas', ['sem foto antes nem durante', 'corrigindo: tem foto durante, só falta antes'],
        'Não Conforme', [B], category='Aceitação complexa separada', contextApplied=True)
    add('dois defeitos de execução', 'não registraram a condição inicial nem o trabalho em andamento',
        'Reprovado', [B, D, COMBO], category='Aceitação complexa separada')
    add('defeitos com medição', 'equipe interna sem aferição da vala. A metragem não bate com as fotos. Sem foto depois.',
        'Reprovado', [INTERNAL, MEASURE, A], category='Aceitação complexa separada')
    add('retificação não apaga acabamento', ['equipe terceirizada sem aferição da vala. Acabamento inadequado.', 'corrigindo: era interna'],
        'Reprovado', [INTERNAL, 'RULE-ASF-ACABAMENTO-01'], category='Aceitação complexa separada', contextApplied=True)
    add('origem VCG não vira falha atual', 'frente VCG. Sem aferição na OS de origem. A aferição do serviço atual foi apresentada.',
        None, [], category='Aceitação complexa separada')
    add('nova OS limpa falha', ['sem foto depois', 'novo caso', 'a foto depois foi apresentada'],
        None, [], category='Aceitação complexa separada')
    add('suposição não é OS', 'Se faltar foto durante, o que eu faço?', None, [D],
        category='Aceitação complexa separada', expectedIntent='hypothesis', expectedScenario='Não Conforme')
    add('fato desconhecido impede fechar', 'sem foto antes e não mandaram um outro comprovante que não sei explicar',
        None, [B], category='Aceitação complexa separada', pendingRequired=True)
    return rows

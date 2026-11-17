"""Gabarito atualizado por confirmação explícita do responsável em 03/11."""


def cases(store):
    rows = [
        ('interna', ['Equipe interna. A trena impede verificar a metragem.'], 'Não Conforme', ['RULE-ASF-TRENA-01'], False),
        ('terceirizada', ['Equipe terceirizada. A trena impede verificar a metragem.'], 'Reprovado', ['RULE-ASF-TRENA-TERCEIRA-01'], False),
        ('sem equipe', ['A trena impede verificar a metragem.'], None, [], True),
        ('resposta interna', ['A trena impede verificar a metragem.', 'interna'], 'Não Conforme', ['RULE-ASF-TRENA-01'], False),
        ('resposta terceirizada', ['A trena impede verificar a metragem.', 'terceirizada'], 'Reprovado', ['RULE-ASF-TRENA-TERCEIRA-01'], False),
        ('retificação de vínculo', ['Equipe terceirizada. A trena impede verificar a metragem.', 'Corrigindo: a equipe é interna.'], 'Não Conforme', ['RULE-ASF-TRENA-01'], False),
        ('outra reprovação aplicável', ['Equipe interna. A trena impede verificar a metragem. Sem foto depois.'], 'Reprovado', ['RULE-ASF-TRENA-01', 'RULE-ASF-FOTO-DEPOIS-01'], False),
        ('negação do impedimento', ['Equipe interna. A trena não impede verificar a metragem.'], None, [], False),
        ('somente menção', ['Equipe interna usou trena.'], None, [], False),
        ('trena legível', ['Equipe interna. A trena permite conferir a metragem.'], None, [], False),
        ('paráfrase interna', ['Equipe interna. Usaram trena, só que pelas imagens ninguém consegue saber o tamanho real do pedaço asfaltado.'], 'Não Conforme', ['RULE-ASF-TRENA-01'], False),
        ('paráfrase terceirizada', ['Equipe terceirizada. Usaram trena, só que pelas imagens ninguém consegue saber o tamanho real do pedaço asfaltado.'], 'Reprovado', ['RULE-ASF-TRENA-TERCEIRA-01'], False),
    ]
    return [dict(name='Trena: ' + name + ' / ' + sid, category='Trena por vínculo — confirmação 03/11',
        turns=turns, serviceId=sid, expectedDecision=decision, expectedRules=rules, pendingRequired=pending)
        for sid in store.services for name, turns, decision, rules, pending in rows]

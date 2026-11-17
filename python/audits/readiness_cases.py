"""Casos novos de prontidão. O gabarito não depende da saída do modelo."""


def cases(store):
    rows = [
        ('duas falhas no mesmo período', ['Sem foto antes e acabamento mal feito.'], 'Reprovado', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-ACABAMENTO-01']),
        ('outro predicado junto com', ['Sem foto antes junto com acabamento péssimo.'], 'Reprovado', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-ACABAMENTO-01']),
        ('sinalização não é segunda foto', ['Sem foto antes e sem sinalização.'], 'Não Conforme', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-EHS-01']),
        ('nem não inventa o objeto', ['Sem foto antes nem sinalização.'], 'Não Conforme', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-EHS-01']),
        ('orientação fora da base', ['Me explique o almoço da equipe interna.'], None, []),
        ('falha e ponto não esclarecido', ['Sem foto antes e não registraram algo que não sei explicar.'], None, None),
        ('esclarecimento substitui dúvida', ['Sem foto antes. Não registraram uma coisa que não sei explicar.', 'Quis dizer: sem foto durante.'], 'Reprovado', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DURANTE-01', 'RULE-ASF-FOTOS-COMBINADAS-01']),
        ('nova falha não apaga dúvida', ['Sem foto antes. Não registraram uma coisa que não sei explicar.', 'E sem foto durante.'], None, None),
        ('esclarecimento segue no contexto', ['Não registraram uma coisa que não sei explicar.', 'Quis dizer: sem foto antes.', 'E sem foto durante.'], 'Reprovado', ['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DURANTE-01', 'RULE-ASF-FOTOS-COMBINADAS-01']),
        ('retificação negativa não vira falta', ['Não registraram uma coisa que não sei explicar.', 'Quis dizer: não faltou foto depois.'], None, []),
        ('foto positiva com novo defeito', ['Tem foto antes e acabamento inadequado.'], 'Reprovado', ['RULE-ASF-ACABAMENTO-01']),
        ('negação também vale após nem', ['Não faltou foto antes nem sinalização.'], None, []),
        ('sem foto não descreve defeito positivo', ['Sem foto antes e acabamento correto.'], 'Não Conforme', ['RULE-ASF-FOTO-ANTES-01']),
    ]
    result = [dict(name=name + ' / ' + sid, category='Prontidão e conversas novas', serviceId=sid,
        turns=turns, expectedDecision=decision, expectedRules=rules)
        for sid in store.services for name, turns, decision, rules in rows]
    # Orientações sem severidade também precisam de cobertura, não só as
    # conclusões oficiais. Consultar uma regra não prova uma irregularidade.
    orientations = [
        ('retirada sem vala comprovada', 'Desdobro de repavimentação sem evidência de vala.', 'RULE-PARAM-ESCAVACAO-01'),
        ('troca ainda por conferir', 'Código errado.', 'RULE-PARAM-TROCA-CONTEXTO-01'),
        ('evidência própria do executado', 'Adicional executado sem foto antes.', 'RULE-GERAL-EVID-02'),
        ('necessidade do posterior', 'Adicional posterior sem justificativa.', 'RULE-GERAL-EVID-03'),
    ]
    result.extend(dict(name=name + ' / ' + sid, category='Orientações compartilhadas', serviceId=sid,
        turns=[query], expectedDecision=None, expectedRules=[], requiredAnyRules=[rule_id])
        for sid in store.services for name, query, rule_id in orientations)
    return result

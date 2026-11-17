"""Gabarito do TXT de Asfalto e das retificações expressas do responsável.

Isto é teste, não regra de execução. Não adapto os resultados ao modelo.
"""
from .asphalt_cases import B, D, A, COMBO, INTERNAL, CONTRACTOR, ORIGIN, VCG, MEASURE, DUP


def cases(store):
    values = [
        ('1.1 antes', 'Sem foto antes.', 'Não Conforme', [B]),
        ('1.2 durante', 'Sem foto durante.', 'Não Conforme', [D]),
        ('1.3 combinação', 'Sem foto antes e sem foto durante.', 'Reprovado', [B, D, COMBO]),
        ('1.4 depois', 'Sem foto depois.', 'Reprovado', [A]),
        ('1.5 qualidade', 'Fotos tremidas.', 'Não Conforme', ['RULE-ASF-FOTO-QUALIDADE-01']),
        ('2.1 origem', 'Sem OS de origem.', 'Não Conforme', ['RULE-ASF-ORIGEM-01']),
        ('2.2 origem manutenção', 'OS de origem sem aferição. Frente Manutenção.', 'Não Conforme', [ORIGIN]),
        ('2.2 exceção VCG', 'OS de origem sem aferição. Frente VCG.', None, []),
        ('3.1 retificação interna', 'Sem aferição da vala. Equipe interna.', 'Não Conforme', [INTERNAL]),
        ('3.1 terceira', 'Sem aferição da vala. Equipe terceirizada.', 'Reprovado', [CONTRACTOR]),
        ('3.1 perguntar vínculo', 'Sem aferição da vala.', None, []),
        ('3.2 medição', 'Medição incoerente.', 'Não Conforme', [MEASURE]),
        ('3.3 retificação interna', 'A trena impede verificar a metragem. Equipe interna.', 'Não Conforme', ['RULE-ASF-TRENA-01']),
        ('3.3 terceira', 'A trena impede verificar a metragem. Equipe terceirizada.', 'Reprovado', ['RULE-ASF-TRENA-TERCEIRA-01']),
        ('3.3 perguntar vínculo', 'A trena impede verificar a metragem.', None, []),
        ('4.1 vala', 'Vala errada.', 'Reprovado', ['RULE-ASF-LOCAL-01']),
        ('4.2 local', 'Local incorreto.', 'Reprovado', ['RULE-ASF-LOCAL-01']),
        ('5.1 material', 'Executaram concreto no lugar do asfalto.', 'Reprovado', ['RULE-ASF-MATERIAL-01']),
        ('5.2 acabamento', 'Acabamento inadequado.', 'Reprovado', ['RULE-ASF-ACABAMENTO-01']),
        ('6.1 duplicidade', 'Duplicidade confirmada no Field.', 'Reprovado', [DUP]),
        ('7.1 impossibilidade', 'Serviço incompatível sem possibilidade de troca.', 'Reprovado', ['RULE-ASF-TROCA-IMPOSSIVEL-01']),
        ('7.2 troca disponível', 'Código incompatível com a execução. O sistema permite trocar.', 'Não Conforme', ['RULE-ASF-TROCA-01']),
        ('8.1 formulário', 'Formulário preenchido incorretamente.', 'Não Conforme', ['RULE-ASF-FORMULARIO-01']),
        ('9.1 posterior necessário', 'Falta de adicional posterior necessário.', 'Não Conforme', ['RULE-PARAM-GERAL-01']),
        ('9.2 indevido', 'Desdobro indevido.', 'Não Conforme', ['RULE-ASF-DESDOBRO-INDEVIDO-01']),
        ('9.3 excesso', 'Adicional desnecessário.', 'Não Conforme', ['RULE-ASF-DESDOBRO-EXCESSO-01']),
        ('10.1 segurança', 'Sem sinalização.', 'Não Conforme', ['RULE-ASF-EHS-01']),
        ('11.2 conflito', 'Sem foto antes. Acabamento inadequado.', 'Reprovado', [B, 'RULE-ASF-ACABAMENTO-01']),
        ('sem aprovação por silêncio', 'O serviço foi executado.', None, []),
    ]
    rows = []
    for service in store.services:
        for name, query, decision, rules in values:
            extra = dict(pendingRequired=True) if name in ('3.1 perguntar vínculo', '3.3 perguntar vínculo') else {}
            if name == '2.2 exceção VCG':
                extra['requiredAnyRules'] = [VCG]
            rows.append(dict(name=name + ' / ' + service, category='Documento Asfalto e retificações',
                serviceId=service, turns=[query], expectedDecision=decision, expectedRules=rules, **extra))
    return rows

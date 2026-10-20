"""Relatos maiores com escopos diferentes. Gabarito não depende do motor."""
from .asphalt_cases import case, A, B, D, COMBO, INTERNAL, CONTRACTOR, ORIGIN, VCG, MEASURE

CATEGORY = 'Relatos longos e escopos mistos'


def cases():
    return [
        case('atual sem aferição, origem regular, interna', CATEGORY,
            'Estou analisando o asfalto atual, não o serviço anterior. A equipe é interna. '
            'Sem aferição da vala do serviço atual. A aferição da OS de origem foi apresentada. '
            'Tem foto antes, tem foto durante e tem foto depois. O acabamento está correto.',
            'Não Conforme', [INTERNAL], contentContains=['retrabalho']),
        case('atual sem aferição, origem regular, terceira', CATEGORY,
            'A OS atual é de Repavimentação Asfalto. Equipe terceirizada sem aferição da vala atual. '
            'Na OS de origem há aferição comprovada. As fotos de antes, execução e final existem. '
            'A falha que estou relatando é apenas a medição da vala deste serviço atual.',
            'Reprovado', [CONTRACTOR]),
        case('VCG origem ausente mas atual regular', CATEGORY,
            'A frente é VCG. Sem aferição na OS de origem. No asfalto atual há foto antes, '
            'foto durante e foto depois. A aferição do serviço atual foi apresentada. '
            'Não estou declarando conferência completa de todos os outros critérios.',
            None, [], requiredAnyRules=[VCG]),
        case('VCG não elimina falta atual', CATEGORY,
            'Frente VCG. Sem aferição na OS de origem. Equipe interna sem aferição da vala do serviço atual. '
            'Há foto antes e foto depois do asfalto. A exceção de VCG se refere à origem, '
            'e minha dúvida é a falta de aferição na repavimentação atual.',
            'Não Conforme', [INTERNAL], contentContains=['retrabalho']),
        case('adicional terceira não é original', CATEGORY,
            'A OS original é Repavimentação Asfalto e tem suas fotos. Equipe terceirizada lançou '
            'repavimentação no adicional executado sem aferição. Este último relato é sobre '
            'o serviço adicional, não sobre a aferição do original. Preciso corrigir o lançamento.',
            'Não Conforme', ['RULE-PAV-AFERICAO-ADICIONAL-TERCEIRA-01'], contentContains=['remova', 'posterior']),
        case('medição e final ausentes em linguagem diferente', CATEGORY,
            'A foto antes está presente. A execução durante também foi registrada. '
            'O número informado no relatório não corresponde ao tamanho do trecho que aparece nas imagens. '
            'Além disso, não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.',
            'Reprovado', [MEASURE, A]),
        case('não aplicar exemplo como fato atual', CATEGORY,
            'Estou montando uma orientação para treinamento, não relatando uma falha nesta OS. '
            'A frase "sem foto depois" é só um exemplo de uma situação hipotética. '
            'Neste caso real, há foto depois, há foto antes e a execução foi registrada.',
            None, []),
        case('falta dupla e dados corretos', CATEGORY,
            'O endereço está correto e o formulário está preenchido corretamente. '
            'Não registraram a vala antes do trabalho nem o serviço sendo feito. '
            'Enviaram apenas foto de tudo pronto. Não há nenhuma falha de segurança relatada.',
            'Reprovado', [B, D, COMBO]),
        case('frente corrigida para VCG', CATEGORY,
            ['Sem aferição na OS de origem, frente manutenção.',
             'Corrigindo a informação anterior: a frente é VCG. Estou falando somente da origem, '
             'não de ausência de aferição do serviço de asfalto atual.'],
            None, [], requiredAnyRules=[VCG], contextApplied=True),
        case('disponibilidade de troca ainda desconhecida', CATEGORY,
            'A equipe fez um serviço diferente do tipo lançado na OS, no endereço correto. '
            'Ainda preciso abrir o sistema para conferir se existe a opção correta para trocar. '
            'Não confirmei impossibilidade de troca nem estou afirmando que a troca estava disponível.',
            None, []),
        case('resultado final presente e inicial sem registro', CATEGORY,
            'A equipe informou que já encerrou a visita e enviou imagem do pavimento pronto. '
            'O endereço da execução está correto. Mas não registraram como estava a vala '
            'antes de começar a repavimentação. Não há relato de outra irregularidade.',
            'Não Conforme', [B]),
        case('atual não confundir com origem na devolutiva', CATEGORY,
            ['Sem aferição da vala.',
             'É equipe interna. Estou falando do serviço atual. A ordem de origem tem suas '
             'medidas, mas no asfalto que estou analisando não mostraram a aferição da vala.'],
            'Não Conforme', [INTERNAL], contentContains=['retrabalho'], contextApplied=True),
    ]

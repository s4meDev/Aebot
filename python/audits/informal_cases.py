"""Novos relatos escritos antes de testar o novo fluxo semântico.

São exemplos sintéticos fundamentados na base, não conversas dos analistas.
Não altero o gabarito para acomodar a saída do modelo.
"""
from .asphalt_cases import case, B, D, A, COMBO, INTERNAL, CONTRACTOR, MEASURE, DUP


def cases():
    informal = 'Informais adicionais'
    negative = 'Controles informais de presença e contexto'
    complex_category = 'Complexos informais adicionais'
    rows = []
    def add(name, query, decision, rules, category=informal, **checks):
        rows.append(case(name, category, query, decision, rules, **checks))
    for index, query in enumerate([
        'a turma fez o asfalto mas não anexou nada mostrando eles trabalhando',
        'tem o começo e o pronto, só não tem o pessoal fazendo o serviço',
        'a execução aconteceu só que ficou sem imagem enquanto aplicavam a massa',
        'não registraram o andamento da repavimentação',
    ]):
        add(f'durante informal {index}', query, 'Não Conforme', [D])
    for index, query in enumerate([
        'o povo terminou mas não subiu nenhuma imagem do resultado',
        'fizeram tudo e esqueceram de anexar a foto do asfalto pronto',
        'a conclusão da repavimentação ficou sem registro fotográfico',
        'não tem imagem de como entregaram o pavimento no fim',
    ]):
        add(f'final informal {index}', query, 'Reprovado', [A])
    for index, query in enumerate([
        'não tem como saber como tava a vala antes de mexerem',
        'só esqueceram de fotografar a condição inicial',
        'faltam imagens do local antes de começar a obra',
        'a chegada no trecho não foi fotografada, ficou sem o antes',
    ]):
        add(f'início informal {index}', query, 'Não Conforme', [B])
    for index, query in enumerate([
        'o asfalto ficou bem mal acabado, todo desnivelado',
        'o resultado final ficou com qualidade ruim e acabamento defeituoso',
        'a recomposição ficou visivelmente mal feita',
    ]):
        add(f'qualidade informal {index}', query, 'Reprovado', ['RULE-ASF-ACABAMENTO-01'])
    for index, query in enumerate([
        'a equipe tapou uma vala que era em outro endereço',
        'asfaltaram um buraco de outra rua, não o dessa ordem',
        'fizeram o serviço no trecho errado',
    ]):
        add(f'local informal {index}', query, 'Reprovado', ['RULE-ASF-LOCAL-01'])
    for index, query in enumerate([
        'colocaram no formulário uma área maior do que a medida nas imagens',
        'a medida lançada não bate com o tamanho mostrado',
        'o relatório tá dizendo uma metragem e as fotos comprovam outra',
    ]):
        add(f'metragem informal {index}', query, 'Não Conforme', [MEASURE])
    for index, query in enumerate([
        'preencheram errado os dados no formulário',
        'o formulário ficou com preenchimento incorreto',
    ]):
        add(f'formulário informal {index}', query, 'Não Conforme', ['RULE-ASF-FORMULARIO-01'])
    for index, query in enumerate([
        'verifiquei no Field que já encerraram esse mesmo serviço numa outra OS',
        'no SCAE confirmei que esse trecho já tinha o serviço concluído em outra ordem',
    ]):
        add(f'duplicidade informal {index}', query, 'Reprovado', [DUP])
    for index, query in enumerate([
        'deixaram de cadastrar um adicional que era necessário',
        'o desdobro que precisava não foi lançado',
    ]):
        add(f'lançamento informal {index}', query, 'Não Conforme', ['RULE-PARAM-GERAL-01'])
    add('troca possível', 'o tipo lançado tá errado, mas o serviço que fizeram está disponível para trocar no sistema',
        'Não Conforme', ['RULE-ASF-TROCA-01'])
    add('troca impossível', 'o tipo tá errado e não existe no sistema a opção correta para trocar', 'Reprovado', None,
        requiredAnyRules=['RULE-ASF-TROCA-IMPOSSIVEL-01', 'RULE-PARAM-TROCA-IMPOSSIVEL-01'])
    for name, query in [
        ('presença durante', 'a turma mandou fotos enquanto espalhava a massa'),
        ('presença final', 'subiram as imagens do asfalto pronto e ficou bom'),
        ('local correto', 'asfaltaram a vala certa, no endereço correto'),
        ('acabamento bom', 'o remendo ficou bem acabado e nivelado'),
        ('metragem coerente', 'a metragem do formulário bate com a comprovada nas imagens'),
        ('duplicidade não confirmada', 'ainda não confirmei no Field se existe outra ordem'),
        ('troca por verificar', 'preciso verificar se o sistema deixa mudar para o serviço certo'),
        ('estado inicial não final', 'antes de executarem o asfalto estava todo desnivelado; depois ficou bom'),
        ('assunto sem fato', 'foto antes durante depois'),
        ('frase negada', 'não disse que esqueceram a foto final'),
        ('qualidade negada', 'não é verdade que o acabamento ficou inadequado'),
        ('cor de uniforme', 'o uniforme da turma era azul e o carro branco'),
    ]:
        add(name, query, None, [], negative)
    add('hipótese de resultado', 'Se não tiver imagem do asfalto pronto, qual seria a conclusão?', None, [A], negative,
        expectedIntent='hypothesis', expectedScenario='Reprovado')
    add('consulta de acabamento', 'Como funciona a regra do acabamento final?', None, None, negative,
        requiredAnyRules=['RULE-ASF-ACABAMENTO-01'])
    add('duas fases e resultado presente', 'Tem a foto pronta. Não tem imagens do início nem deles fazendo a repavimentação.',
        'Reprovado', [B, D, COMBO], complex_category)
    add('falta final e metragem divergente', 'A área lançada não bate com a medida. Não subiram foto de como o pavimento ficou.',
        'Reprovado', [MEASURE, A], complex_category)
    add('equipe informal continua', ['Não mostraram a medição da vala.', 'quem fez foi a equipe da empresa'],
        'Não Conforme', [INTERNAL], complex_category, contextApplied=True, contentContains=['retrabalho'])
    add('corrigir sem perder outra falha', ['Equipe terceirizada sem aferição da vala. Sem foto depois.', 'Corrigindo: foi interna.'],
        'Reprovado', [INTERNAL, A], complex_category, contextApplied=True)
    add('ausência da origem é separada', 'Frente manutenção. A OS de origem não tem aferição. O asfalto atual tem aferição apresentada.',
        'Não Conforme', ['RULE-ASF-ORIGEM-AFERICAO-01'], complex_category)
    add('nova dúvida desconhecida bloqueia', 'Sem foto antes e não registraram aquele outro item que ainda não sei explicar.',
        None, [B], complex_category, pendingRequired=True)
    add('não confundir adicional com original', 'Equipe terceirizada sem aferição na repavimentação do adicional executado. O original tem aferição apresentada.',
        'Não Conforme', ['RULE-PAV-AFERICAO-ADICIONAL-TERCEIRA-01'], complex_category,
        contentContains=['remova', 'posterior'])
    add('fato negado e irregularidade real', 'Não é verdade que faltou foto depois. A metragem lançada é diferente da comprovada nas fotos.',
        'Não Conforme', [MEASURE], complex_category)
    return rows

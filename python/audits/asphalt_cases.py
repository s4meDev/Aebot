"""Gabaritos de auditoria, escritos antes da execução e sem consultar o motor.

IDs aparecem aqui porque isto é teste, não lógica de negócio do aplicativo.
As expectativas vêm das regras cadastradas, não de conhecimento externo.
"""
from itertools import combinations
import json

SMALL = 'repavimentacao-asfalto-ate-1m2'
LARGE = 'repavimentacao-asfalto-acima-1m2'
B = 'RULE-ASF-FOTO-ANTES-01'
D = 'RULE-ASF-FOTO-DURANTE-01'
A = 'RULE-ASF-FOTO-DEPOIS-01'
COMBO = 'RULE-ASF-FOTOS-COMBINADAS-01'
INTERNAL = 'RULE-PAV-AFERICAO-INTERNA-01'
CONTRACTOR = 'RULE-PAV-AFERICAO-TERCEIRA-01'
ORIGIN = 'RULE-ASF-ORIGEM-AFERICAO-01'
VCG = 'RULE-ASF-ORIGEM-VCG-01'
MEASURE = 'RULE-ASF-MEDICAO-01'
DUP = 'RULE-ASF-DUPLICIDADE-01'


def case(name, category, query, decision, rules=None, **checks):
    turns = query if isinstance(query, list) else [query]
    return dict(name=name, category=category, turns=turns, serviceId=SMALL,
        expectedDecision=decision, expectedRules=rules, **checks)


def original_cases(root):
    source = json.loads((root / 'src/data/asphaltPilotCases.json').read_text(encoding='utf-8'))
    rows = []
    for item in source:
        hypothesis = item['name'] == 'hipótese'
        turns = [item['previous'], item['query']] if item.get('previous') else [item['query']]
        checks = dict(expectedScenario=item['decision'], expectedIntent='hypothesis') if hypothesis else {}
        rows.append(case(item['name'], 'Corpus anterior (53)', turns,
            None if hypothesis else item['decision'], item.get('expectedClassifyingRuleIds', []),
            **checks))
        rows[-1]['serviceId'] = item['serviceId']
    return rows


def canonical_combinations(store):
    # Nove fatores explícitos. Exaustivo apenas para esses fatores e frases,
    # não para todas as regras nem para todas as formas de escrever um relato.
    factors = [
        ('Sem foto antes.', B), ('Sem foto durante.', D), ('Sem foto depois.', A),
        ('Formulário preenchido incorretamente.', 'RULE-ASF-FORMULARIO-01'),
        ('Sem sinalização.', 'RULE-ASF-EHS-01'), ('Medição incoerente.', MEASURE),
        ('Acabamento inadequado.', 'RULE-ASF-ACABAMENTO-01'),
        ('Vala errada.', 'RULE-ASF-LOCAL-01'), ('Duplicidade confirmada no Field.', DUP),
    ]
    rules = {rule['id']: rule for rule in store.rules}
    severity = {'Conforme': 0, 'Não Conforme': 1, 'Reprovado': 2}
    rows = []
    for count in range(1, len(factors) + 1):
        for selected in combinations(factors, count):
            ids = [item[1] for item in selected]
            if B in ids and D in ids:
                ids.append(COMBO)
            decision = max((rules[item]['severity'] for item in ids), key=severity.get)
            category = 'Diretas padronizadas' if count == 1 else 'Duas falhas padronizadas' if count == 2 else '3 a 9 falhas padronizadas'
            for service in (SMALL, LARGE):
                row = case('+'.join(item[1] for item in selected) + '/' + service,
                    category, ' '.join(item[0] for item in selected), decision, ids)
                row['serviceId'] = service
                rows.append(row)
    for service in (SMALL, LARGE):
        row = case('conferência completa/' + service, 'Diretas padronizadas',
            'Conferi todos os critérios aplicáveis da repavimentação e não há irregularidades.',
            'Conforme', ['RULE-ASF-CONFORME-01'])
        row['serviceId'] = service
        rows.append(row)
    return rows


def additional_previous():
    from test_semantic import CASES
    expected = [[A], [A], [B], [D], [MEASURE], [DUP], [], [], [], [], [], None, None, None, [], [B, A]]
    rows = []
    for index, (query, decision) in enumerate(CASES):
        checks = {}
        if index == 11:
            checks['requiredAnyRules'] = ['RULE-PAV-INFO-02', 'RULE-GERAL-EVID-01']
        elif index == 12:
            checks['requiredAnyRules'] = [DUP]
        elif index == 13:
            checks['requiredAnyRules'] = ['RULE-ASF-ACABAMENTO-01']
        rows.append(case(query, 'Paráfrases anteriores (16)', query, decision, expected[index], **checks))
    return rows


def novel_cases():
    language = 'Linguagem livre nova'
    negation = 'Negação, presença e hipótese'
    context = 'Conversa e retificações'
    scope = 'Equipe, origem e adicional'
    rows = [
        case('execução sem registro informal', language, 'a turma asfaltou mas não fotografou enquanto trabalhava', 'Não Conforme', [D]),
        case('resultado informal', language, 'terminaram o asfalto e não mandaram nenhuma foto de como ficou', 'Reprovado', [A]),
        case('início informal', language, 'não dá pra ver como tava o local quando o pessoal chegou pra começar', 'Não Conforme', [B]),
        case('somente final explicitado', language, 'Só tem a foto final. Não há registro do antes nem do durante.', 'Reprovado', [B, D, COMBO]),
        case('tamanho divergente', language, 'No relatório escreveram uma área maior do que a que aparece medida nas fotos.', 'Não Conforme', [MEASURE]),
        case('acabamento ruim informal', language, 'o remendo ficou todo desnivelado e mal acabado', 'Reprovado', ['RULE-ASF-ACABAMENTO-01']),
        case('local divergente informal', language, 'tamparam uma vala de outra rua e encerraram esta ordem', 'Reprovado', ['RULE-ASF-LOCAL-01']),
        case('formulário informal', language, 'o preenchimento do formulário tá errado', 'Não Conforme', ['RULE-ASF-FORMULARIO-01']),
        case('dup comprovada informal', language, 'olhei no SCAE e confirmei que o mesmo serviço desse trecho já tinha sido concluído em outra ordem', 'Reprovado', [DUP]),
        case('falta lançamento informal', language, 'esqueceram de lançar o desdobro necessário', 'Não Conforme', ['RULE-PARAM-GERAL-01']),
        case('troca disponível informal', language, 'o código não bate com o que fizeram, mas dá para mudar para o tipo correto no sistema', 'Não Conforme', ['RULE-ASF-TROCA-01']),
        case('sem alternativa troca informal', language, 'a OS tá com tipo errado e o sistema não oferece o serviço que realmente fizeram para trocar', 'Reprovado', None,
            requiredAnyRules=['RULE-ASF-TROCA-IMPOSSIVEL-01', 'RULE-PARAM-TROCA-IMPOSSIVEL-01']),
        case('informativa aferição', language, 'Como devo tratar uma OS de asfalto sem aferição?', None, None,
            requiredAnyRules=['RULE-PAV-AFERICAO-CONTEXTO-01'], pendingContains='equipe'),
        case('informativa qualidade', language, 'Que decisão cabe para acabamento inadequado?', None, ['RULE-ASF-ACABAMENTO-01']),
        case('negando a ocorrência', negation, 'Não é verdade que faltou foto depois.', None, []),
        case('falta explicitamente negada', negation, 'Não houve falta de foto depois.', None, []),
        case('negando incoerência', negation, 'A medição não é incoerente.', None, []),
        case('foto com falta de nitidez', negation, 'A foto final existe, mas está sem nitidez.', 'Não Conforme', ['RULE-ASF-FOTO-QUALIDADE-01']),
        case('não antes mas depois', negation, 'Não faltou foto antes, mas faltou foto depois.', 'Reprovado', [A]),
        case('dupla negação durante', negation, 'Não faltou foto durante, mas sem foto antes.', 'Não Conforme', [B]),
        case('trena não impeditiva', negation, 'A trena não impede verificar a metragem.', None, []),
        case('mera possibilidade duplicidade', negation, 'Talvez haja outra OS, mas ainda não consultei o Field nem o SCAE.', None, [], pendingRequired=True),
        case('não confirmou duplicidade', negation, 'Não confirmei duplicidade no Field.', None, []),
        case('citação não é fato', negation, 'A expressão "sem foto depois" foi só um exemplo, não é o que aconteceu nesta OS.', None, []),
        case('hipótese dupla', negation, 'Se faltar foto antes e durante, qual seria a conclusão?', None, [B, D, COMBO],
            expectedScenario='Reprovado', expectedIntent='hypothesis'),
        case('hipótese foto em linguagem livre', negation, 'Se não mandarem imagem de como ficou o pavimento ao terminar, o que devo fazer?', None, [A],
            expectedScenario='Reprovado', expectedIntent='hypothesis'),
        case('desconhecido não aprova', negation, 'A equipe chegou com o uniforme azul.', None, []),
        case('termo incompleto não aprova', negation, 'O registro está incompleto.', None, []),
        case('equipe pendente interna', context, ['Sem aferição da vala.', 'interna'], 'Não Conforme', [INTERNAL],
            pendingRequired=False, contentContains=['retrabalho'], contextApplied=True),
        case('equipe pendente terceira', context, ['Sem aferição da vala.', 'terceirizada'], 'Reprovado', [CONTRACTOR],
            pendingRequired=False, contextApplied=True),
        case('equipe própria informal', context, ['Sem aferição da vala.', 'foi o pessoal da própria empresa'], 'Não Conforme', [INTERNAL], contextApplied=True),
        case('origem pendente manutenção', context, ['Sem aferição na OS de origem.', 'Manutenção'], 'Não Conforme', [ORIGIN], contextApplied=True),
        case('origem pendente VCG', context, ['Sem aferição na OS de origem.', 'VCG'], None, [], requiredAnyRules=[VCG], contextApplied=True),
        case('mudar tipo equipe', context, ['Equipe terceirizada sem aferição da vala.', 'Na verdade, a equipe era interna.'], 'Não Conforme', [INTERNAL],
            contentContains=['retrabalho'], contextApplied=True),
        case('mudar tipo equipe outra direção', context, ['Equipe interna sem aferição da vala.', 'Corrigindo, foi equipe terceirizada.'], 'Reprovado', [CONTRACTOR], contextApplied=True),
        case('retirar ausência final', context, ['Sem foto depois.', 'Corrigindo, a foto depois foi apresentada.'], None, [], contextApplied=True),
        case('corrigir antes manter durante', context, ['Sem foto antes nem durante.', 'Corrigindo, tem foto antes. Continua sem foto durante.'], 'Não Conforme', [D], contextApplied=True),
        case('troca explícita caso', context, ['Sem foto antes.', 'Outro caso: sem foto durante.'], 'Não Conforme', [D], contextApplied=False),
        case('somar antes durante', context, ['Sem foto antes.', 'Mas sem foto durante também.'], 'Reprovado', [B, D, COMBO], contextApplied=True),
        case('equipe mais falha final', context, ['Sem aferição da vala.', 'interna e sem foto depois'], 'Reprovado', [INTERNAL, A], contextApplied=True),
        case('resposta vaga mantém pendência', context, ['Sem aferição da vala.', 'não sei informar'], None, [], pendingRequired=True, contextApplied=True),
        case('original interna', scope, 'Equipe interna sem aferição da vala.', 'Não Conforme', [INTERNAL], contentContains=['retrabalho']),
        case('original terceira', scope, 'Equipe terceirizada sem aferição da vala.', 'Reprovado', [CONTRACTOR]),
        case('original equipe ausente', scope, 'Sem aferição da vala.', None, [], pendingContains='equipe'),
        case('adicional interna', scope, 'Equipe interna lançou repavimentação no adicional executado sem aferição.', 'Não Conforme', ['RULE-PAV-AFERICAO-ADICIONAL-INTERNA-01'],
            contentContains=['retrabalho', 'posterior']),
        case('adicional terceira', scope, 'Equipe terceirizada lançou repavimentação no adicional executado sem aferição.', 'Não Conforme', ['RULE-PAV-AFERICAO-ADICIONAL-TERCEIRA-01'],
            contentContains=['remova', 'posterior']),
        case('adicional equipe ausente', scope, 'Adicional executado de repavimentação sem aferição.', None, [], pendingContains='equipe'),
        case('origem manutenção', scope, 'Sem aferição na OS de origem, frente manutenção.', 'Não Conforme', [ORIGIN]),
        case('origem comercial', scope, 'Sem aferição na OS de origem, frente comercial.', 'Não Conforme', [ORIGIN]),
        case('origem VCG', scope, 'Sem aferição na OS de origem, é VCG.', None, [], requiredAnyRules=[VCG]),
        case('origem e atual separadas', scope, 'Equipe interna sem aferição da vala atual. A aferição da OS de origem foi apresentada.', 'Não Conforme', [INTERNAL]),
        case('VCG não isenta serviço atual', scope, 'Frente VCG. Equipe terceirizada sem aferição da vala do serviço atual.', 'Reprovado', [CONTRACTOR]),
        case('origem concreto não é atual', scope, 'A OS de origem é de concreto. No serviço atual foi aplicado asfalto.', None, []),
        case('material atual incorreto', scope, 'Fez concreto na OS de asfalto.', 'Reprovado', ['RULE-ASF-MATERIAL-01']),
        case('aferição presente', scope, 'A equipe interna executou o serviço com aferição da vala apresentada.', None, []),
        case('menção aferição não falta', scope, 'Qual é o padrão da aferição da vala?', None, None,
            requiredAnyRules=['RULE-PAV-INFO-02', 'RULE-PAV-AFERICAO-CONTEXTO-01', 'RULE-PAV-01']),
    ]
    return rows


def remaining_rule_coverage():
    rows = []
    for query, rule, decision in [
        ('A medição foi apresentada em formato não aceito.', 'RULE-PAV-01', 'Não Conforme'),
        ('Execução incompatível sem opção de troca.', 'RULE-ASF-TROCA-IMPOSSIVEL-01', 'Reprovado'),
        ('O sistema não permite trocar para o serviço correto.', 'RULE-PARAM-TROCA-IMPOSSIVEL-01', 'Reprovado'),
    ]:
        for service in (SMALL, LARGE):
            row = case(rule + '/' + service, 'Cobertura classificatória complementar', query, decision, [rule])
            row['serviceId'] = service
            rows.append(row)
    return rows

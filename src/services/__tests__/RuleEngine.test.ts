import { describe, expect, it } from 'vitest';
import type { DataRule, DecisionType, RuleStoreSchema } from '../../types';
import { RuleEngine, ruleEngine } from '../RuleEngine';
import { findExpression, normalizeText } from '../TextNormalizer';

const selectedServiceId = ruleEngine.getServices()[0].id;

function conclusions(): RuleStoreSchema['conclusions'] {
  const values: Array<[DecisionType, number]> = [
    ['Reprovado', 1],
    ['Não Conforme', 2],
    ['Conforme', 3],
  ];
  return Object.fromEntries(
    values.map(([severity, priority]) => [
      severity,
      { severity, priority, description: severity },
    ])
  ) as RuleStoreSchema['conclusions'];
}

function rule(overrides: Partial<DataRule> & Pick<DataRule, 'id' | 'severity'>): DataRule {
  return {
    serviceId: 'service-a',
    title: overrides.id,
    description: overrides.id,
    priority: 2,
    conditionKeywords: ['cenário aplicável'],
    message: overrides.id,
    ...overrides,
  };
}

function store(rules: DataRule[], serviceIds = ['service-a']): RuleStoreSchema {
  return {
    version: '2.0.0',
    conclusions: conclusions(),
    services: serviceIds.map((id) => ({
      id,
      name: id,
      category: 'test',
      summary: 'test',
      insights: [],
    })),
    rules,
  };
}

describe('RuleEngine — recuperação e evidência', () => {
  it('retorna sem decisão quando não existe regra relevante', () => {
    const result = ruleEngine.evaluatePrompt('A equipe chegou cedo ao endereço.', selectedServiceId);
    expect(result.decision).toBeNull();
    expect(result.hasSufficientEvidence).toBe(false);
    expect(result.requiresHumanValidation).toBe(true);
    expect(result.outcome).toBe('insufficient');
    expect(result.insufficiencyReason).toBe('no_matching_rule');
  });

  it('não confunde "incompleto" com "completo"', () => {
    expect(findExpression(normalizeText('O relatório está incompleto.'), 'completo')).toBeNull();
    const engine = new RuleEngine(store([
      rule({ id: 'positive', severity: 'Conforme', conditionKeywords: ['completo'] }),
    ]));
    expect(engine.evaluatePrompt('O relatório está incompleto.', 'service-a').decision).toBeNull();
  });

  it('não trata a simples menção a antes como ausência', () => {
    const result = ruleEngine.evaluatePrompt('Quero entender a etapa antes.', selectedServiceId);
    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('informational');
    expect(result.hasSufficientEvidence).toBe(false);
    expect(result.requiresHumanValidation).toBe(false);
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  it('respeita um sinal explícito que nega a ausência', () => {
    const result = ruleEngine.evaluatePrompt('Não faltou foto depois.', selectedServiceId);
    expect(result.decision).toBeNull();
    expect(result.primaryRule).toBeNull();
    expect(result.matchedRules.length).toBeGreaterThan(0);
    expect(result.insufficiencyReason).toBe('missing_information');
  });

  it('distingue tema conhecido com poucos fatos de regra inexistente', () => {
    const result = ruleEngine.evaluatePrompt('A foto depois foi apresentada.', selectedServiceId);
    expect(result.outcome).toBe('insufficient');
    expect(result.decision).toBeNull();
    expect(result.insufficiencyReason).toBe('missing_information');
    expect(result.reasoningSummary).toContain('regras relacionadas');
  });

  it('faz a informação mais recente prevalecer para a mesma evidência', () => {
    const result = ruleEngine.evaluatePrompt(
      'Faltaram as fotos antes e durante. Na verdade, a foto durante foi apresentada.',
      selectedServiceId
    );
    expect(result.decision).toBe('Não Conforme');
    expect(result.matchedRules.every((rule) => rule.severity === 'Não Conforme')).toBe(true);
  });

  it('identifica pergunta hipotética e aplica a regra do cenário', () => {
    const result = ruleEngine.evaluatePrompt('Se faltar a foto depois, reprova?', selectedServiceId);
    expect(result.intent).toBe('hipotese');
    expect(result.decision).toBe('Reprovado');
    expect(result.reasoningSummary).toContain('No cenário descrito');
  });

  it('não transforma pergunta informativa em irregularidade', () => {
    const result = ruleEngine.evaluatePrompt('Qual é a regra da foto depois?', selectedServiceId);
    expect(result.intent).toBe('pergunta_informativa');
    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('informational');
    expect(result.primaryRule).not.toBeNull();
  });

  it('responde visão geral somente com o cadastro do serviço', () => {
    const result = ruleEngine.evaluatePrompt('Como funciona esse serviço?', selectedServiceId);
    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.primaryRule).toBeNull();
    expect(result.serviceContext?.summary).toBeTruthy();
    expect(result.requiresHumanValidation).toBe(false);
  });

  it('mantém pergunta externa à base como insuficiente', () => {
    const result = ruleEngine.evaluatePrompt('Qual é a capital do Brasil?', selectedServiceId);
    expect(result.outcome).toBe('insufficient');
    expect(result.decision).toBeNull();
    expect(result.requiresHumanValidation).toBe(true);
  });

  it('conecta abreviações e palavras de ligação sem usar substring', () => {
    expect(findExpression(normalizeText('ft do dps'), 'foto depois')).toBe('foto do depois');
    const result = ruleEngine.evaluatePrompt('n tem ft dps', selectedServiceId);
    expect(result.normalizedQuery).toBe('nao tem foto depois');
    expect(result.decision).toBe('Reprovado');
  });

  it('conecta sinônimos temporais à mesma evidência cadastrada', () => {
    const after = ruleEngine.evaluatePrompt('Sem foto após.', selectedServiceId);
    const posterior = ruleEngine.evaluatePrompt(
      'Não anexaram a imagem posterior.',
      selectedServiceId
    );
    const anterior = ruleEngine.evaluatePrompt('Imagem anterior ausente.', selectedServiceId);
    const plural = ruleEngine.evaluatePrompt('Sem imagens posteriores.', selectedServiceId);
    const intermediate = ruleEngine.evaluatePrompt(
      'Sem imagem intermediária.',
      selectedServiceId
    );

    expect(after.normalizedQuery).toBe('sem foto depois');
    expect(after.decision).toBe('Reprovado');
    expect(posterior.normalizedQuery).toBe('nao apresentou a foto depois');
    expect(posterior.decision).toBe('Reprovado');
    expect(anterior.normalizedQuery).toBe('foto antes ausente');
    expect(anterior.decision).toBe('Não Conforme');
    expect(plural.normalizedQuery).toBe('sem foto depois');
    expect(plural.decision).toBe('Reprovado');
    expect(intermediate.normalizedQuery).toBe('sem foto durante');
    expect(intermediate.decision).toBe('Não Conforme');
  });

  it('usa sinônimos em perguntas informativas sem fingir ocorrência', () => {
    const result = ruleEngine.evaluatePrompt(
      'Qual é a regra da ausência da imagem posterior?',
      selectedServiceId
    );

    expect(result.normalizedQuery).toBe('qual e a regra da ausente da foto depois');
    expect(result.intent).toBe('pergunta_informativa');
    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
  });

  it('reconhece relato afirmativo de ausência de evidência', () => {
    const result = ruleEngine.evaluatePrompt('A foto depois não foi apresentada.', selectedServiceId);
    expect(result.intent).toBe('relato_afirmativo');
    expect(result.decision).toBe('Reprovado');
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  it('compõe ausência com ações cadastradas da etapa durante', () => {
    const virola = ruleEngine.evaluatePrompt(
      'Não mostrou apertando a virola.',
      selectedServiceId
    );
    const doing = ruleEngine.evaluatePrompt('Sem foto fazendo.', selectedServiceId);
    const informal = ruleEngine.evaluatePrompt(
      'Não mandaram imagem fazendo o reparo.',
      selectedServiceId
    );
    const adjustment = ruleEngine.evaluatePrompt(
      'Não exibiu o ajuste da virola.',
      selectedServiceId
    );
    const ongoing = ruleEngine.evaluatePrompt(
      'Faltou registro do reparo em andamento.',
      selectedServiceId
    );
    const execution = ruleEngine.evaluatePrompt(
      'Não tem comprovação da execução do reparo.',
      selectedServiceId
    );

    for (const result of [virola, doing, informal, adjustment, ongoing, execution]) {
      expect(result.intent).toBe('relato_afirmativo');
      expect(result.decision).toBe('Não Conforme');
      expect(result.primaryRule?.title).toBe('Falta da foto durante a execução');
    }
  });

  it('não transforma ação comprovada em ausência da etapa durante', () => {
    const result = ruleEngine.evaluatePrompt(
      'Mostrou a equipe apertando a virola.',
      selectedServiceId
    );

    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('insufficient');
    expect(result.insufficiencyReason).toBe('missing_information');
  });

  it('retorna várias regras relevantes', () => {
    const result = ruleEngine.evaluatePrompt(
      'Faltou a foto depois e o chassi ilegível.',
      selectedServiceId
    );
    expect(result.matchedRules.length).toBeGreaterThanOrEqual(2);
    expect(new Set(result.matchedRules.map((item) => item.severity))).toEqual(
      new Set<DecisionType>(['Reprovado', 'Não Conforme'])
    );
  });

  it('registra conflito entre conclusões diferentes', () => {
    const result = ruleEngine.evaluatePrompt(
      'Faltou a foto depois e o chassi ilegível.',
      selectedServiceId
    );
    expect(result.decision).toBe('Reprovado');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].winnerRuleId).toBe(result.primaryRule?.id);
  });
});

describe('RuleEngine — ranking e serviço', () => {
  it('prioriza Reprovado sobre Não Conforme quando ambas são igualmente aplicáveis', () => {
    const engine = new RuleEngine(store([
      rule({ id: 'reject', severity: 'Reprovado', priority: 1 }),
      rule({ id: 'warning', severity: 'Não Conforme', priority: 2 }),
    ]));
    const result = engine.evaluatePrompt('Cenário aplicável.', 'service-a');
    expect(result.matchedRules).toHaveLength(2);
    expect(result.decision).toBe('Reprovado');
  });

  it('faz a regra mais específica vencer uma regra genérica', () => {
    const engine = new RuleEngine(store([
      rule({
        id: 'generic',
        severity: 'Reprovado',
        priority: 1,
        conditionKeywords: ['sem foto'],
      }),
      rule({
        id: 'specific',
        severity: 'Não Conforme',
        priority: 2,
        conditionKeywords: ['sem foto antes'],
      }),
    ]));
    const result = engine.evaluatePrompt('Sem foto antes.', 'service-a');
    expect(result.matchedRules).toHaveLength(2);
    expect(result.primaryRule?.id).toBe('specific');
    expect(result.decision).toBe('Não Conforme');
  });

  it('compõe fatos confirmados por regras-base sem duplicar seus sinônimos', () => {
    const engine = new RuleEngine(store([
      rule({
        id: 'stage-alpha',
        severity: 'Não Conforme',
        conditionKeywords: ['sem evidência alfa'],
        factGroup: 'alpha',
      }),
      rule({
        id: 'stage-beta',
        severity: 'Não Conforme',
        conditionKeywords: ['trabalho beta não mostrado'],
        factGroup: 'beta',
      }),
      rule({
        id: 'aggregate',
        severity: 'Reprovado',
        priority: 1,
        conditionKeywords: [],
        matchPolicy: {
          minimumMatchedFactGroups: { count: 2, groups: ['alpha', 'beta'] },
        },
      }),
    ]));

    const result = engine.evaluatePrompt(
      'Sem evidência alfa e trabalho beta não mostrado.',
      'service-a'
    );

    expect(result.decision).toBe('Reprovado');
    expect(result.primaryRule?.id).toBe('aggregate');
    expect(result.primaryRule?.supportingRuleIds).toEqual(['stage-alpha', 'stage-beta']);
  });

  it('usa somente as regras do serviceId selecionado', () => {
    const engine = new RuleEngine(store([
      rule({ id: 'a', serviceId: 'service-a', severity: 'Reprovado' }),
      rule({ id: 'b', serviceId: 'service-b', severity: 'Conforme', priority: 3 }),
    ], ['service-a', 'service-b']));
    const result = engine.evaluatePrompt('Cenário aplicável.', 'service-b');
    expect(result.serviceId).toBe('service-b');
    expect(result.decision).toBe('Conforme');
    expect(result.matchedRules.map((item) => item.id)).toEqual(['b']);
  });

  it('aplica orientação geral a novo serviço ativo sem copiar seu ID', () => {
    const generalRule = rule({
      id: 'general-guidance',
      severity: undefined,
      appliesToAllActiveServices: true,
      conditionKeywords: ['evidência geral ausente'],
      attentionLevel: 'critical',
    });
    const engine = new RuleEngine(store([generalRule], ['service-a', 'service-new']));

    const result = engine.evaluatePrompt('Evidência geral ausente.', 'service-new');
    expect(result.decision).toBeNull();
    expect(result.matchedRules[0]?.id).toBe('general-guidance');
  });

  it('retorna erro controlado para serviceId inexistente', () => {
    const result = ruleEngine.evaluatePrompt('Sem foto depois.', 'servico-inexistente');
    expect(result.decision).toBeNull();
    expect(result.errorCode).toBe('SERVICE_NOT_FOUND');
    expect(result.outcome).toBe('insufficient');
    expect(result.insufficiencyReason).toBe('service_not_found');
    expect(result.requiresHumanValidation).toBe(true);
  });

  it('não decide serviço cuja parametrização existe mas as regras ainda estão pendentes', () => {
    const result = ruleEngine.evaluatePrompt(
      'O serviço foi executado corretamente.',
      'desobstrucao-ramal-agua'
    );
    expect(result.decision).toBeNull();
    expect(result.errorCode).toBe('SERVICE_RULES_PENDING');
    expect(result.insufficiencyReason).toBe('service_rules_pending');
    expect(result.requiresHumanValidation).toBe(true);
  });

  it('trata adicional executado sem evidência própria como atenção crítica sem inventar decisão', () => {
    const result = ruleEngine.evaluatePrompt(
      'O desdobro executado ficou sem foto durante.',
      'reparo-rede-agua-asfalto'
    );

    expect(result.outcome).toBe('insufficient');
    expect(result.decision).toBeNull();
    expect(result.insufficiencyReason).toBe('missing_information');
    expect(result.matchedRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'RULE-GERAL-EVID-02', attentionLevel: 'critical' }),
    ]));
  });

  it('exige motivo do adicional posterior sem fingir que o serviço futuro foi executado', () => {
    const result = ruleEngine.evaluatePrompt(
      'Lançou o adicional posterior mas não mostrou a necessidade.',
      'implantacao-ligacao-agua'
    );

    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('insufficient');
    expect(result.matchedRules.some((item) => item.id === 'RULE-GERAL-EVID-03')).toBe(true);
  });

  it('não herda a severidade do cavalete para falta de etapa em outro serviço', () => {
    const result = ruleEngine.evaluatePrompt(
      'O serviço original ficou sem foto durante.',
      'reparo-rede-agua-asfalto'
    );

    expect(result.decision).toBeNull();
    expect(result.matchedRules.every((item) => item.severity === null)).toBe(true);
  });

  it('aplica Não Conforme somente à medição de repavimentação explicitamente fora do padrão', () => {
    const invalid = ruleEngine.evaluatePrompt(
      'A medição foi apresentada em formato não aceito.',
      'repavimentacao-calcada'
    );
    const informative = ruleEngine.evaluatePrompt(
      'Como deve ser a medição da repavimentação?',
      'repavimentacao-calcada'
    );

    expect(invalid.decision).toBe('Não Conforme');
    expect(invalid.primaryRule?.id).toBe('RULE-PAV-01');
    expect(informative.decision).toBeNull();
    expect(informative.outcome).toBe('informational');
  });

  it('entende que afirmar falta do desdobro já confirma necessidade e ausência', () => {
    const exact = ruleEngine.evaluatePrompt(
      'Falta de desdobro para Repavimentação Calçada.',
      'reparo-cavalete'
    );
    const informal = ruleEngine.evaluatePrompt(
      'Era pra ter repav da calçada e não lançaram.',
      'reparo-ramal-agua-calcada'
    );

    for (const result of [exact, informal]) {
      expect(result.intent).toBe('relato_afirmativo');
      expect(result.decision).toBe('Não Conforme');
      expect(result.primaryRule?.id).toBe('RULE-PARAM-REPAV-01');
    }
  });

  it('não transforma consulta ou negação sobre desdobro em ocorrência real', () => {
    const question = ruleEngine.evaluatePrompt(
      'Quando devo lançar o desdobro de repavimentação da calçada?',
      'reparo-cavalete'
    );
    const negated = ruleEngine.evaluatePrompt(
      'Não faltou desdobro; a repavimentação foi incluída.',
      'reparo-cavalete'
    );

    expect(question.outcome).toBe('informational');
    expect(question.decision).toBeNull();
    expect(negated.decision).toBeNull();
  });

  it('consulta os novos serviços sem cair em regras pendentes', () => {
    for (const serviceId of [
      'corte-fornecimento-agua',
      'religacao-fornecimento-agua',
      'implantacao-ligacao-agua',
      'reparo-rede-esgoto',
      'extensao-rede-agua',
      'interligacao-rede-agua',
      'verificacao-falta-agua',
    ]) {
      const result = ruleEngine.evaluatePrompt('Como funciona esse serviço?', serviceId);
      expect(result.errorCode).toBeUndefined();
      expect(result.outcome).toBe('informational');
      expect(result.decision).toBeNull();
    }
  });

  it('responde informativamente com a parametrização cadastrada', () => {
    const result = ruleEngine.evaluatePrompt(
      'Quais serviços estão disponíveis na parametrização?',
      selectedServiceId
    );
    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.requiresHumanValidation).toBe(false);
    expect(result.reasoningSummary).toContain('Troca de Serviço:');
    expect(result.reasoningSummary).toContain('Adicional Executado:');
    expect(result.reasoningSummary).toContain('Adicional Posterior:');
  });

  it('explica quando aceitar reparo de ramal como adicional executado', () => {
    const result = ruleEngine.evaluatePrompt(
      'Quando posso lançar reparo de ramal no adicional executado?',
      selectedServiceId
    );

    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.reasoningSummary).toContain('Adicional Executado');
    expect(result.reasoningSummary).toContain('intervenção no ramal');
  });

  it('explica a variação do ramal para bloco e revestimentos equivalentes', () => {
    const result = ruleEngine.evaluatePrompt(
      'Qual ramal usar se o piso é pedra portuguesa?',
      selectedServiceId
    );

    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.reasoningSummary).toContain('Bloco/Paralelo');
  });

  it('não recomenda Furto/Vandalismo como executado', () => {
    const result = ruleEngine.evaluatePrompt(
      'Posso colocar furto e vandalismo no executado?',
      selectedServiceId
    );

    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.reasoningSummary).toContain('Não lance Furto/Vandalismo');
  });

  it('compartilha o padrão de fotos entre as variações de reparo de ramal', () => {
    const serviceIds = [
      'reparo-ramal-agua-asfalto',
      'reparo-ramal-agua-bloco-paralelo',
      'reparo-ramal-agua-calcada',
      'reparo-ramal-agua-terra',
      'reparo-ramal-agua-causado-por-terceiros',
    ];

    for (const serviceId of serviceIds) {
      const result = ruleEngine.evaluatePrompt(
        'Quais fotos comprovam o reparo de ramal?',
        serviceId
      );
      expect(result.outcome).toBe('informational');
      expect(result.decision).toBeNull();
      expect(result.reasoningSummary).toContain('fachada/local');
      expect(result.requiresHumanValidation).toBe(false);
    }
  });

  it('orienta falta de evidência no ramal sem inventar conclusão oficial', () => {
    const result = ruleEngine.evaluatePrompt(
      'Só mostrou o cavalete e não provou o conserto do ramal.',
      'reparo-ramal-agua-calcada'
    );

    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('insufficient');
    expect(result.matchedRules.some((rule) => rule.id === 'RULE-RR-INFO-02')).toBe(true);
  });

  it('compartilha o padrão fotográfico entre os tipos de reaterro', () => {
    for (const serviceId of ['reaterro-valas-asfalto', 'reaterro-valas-calcada', 'reaterro-valas-terra']) {
      const result = ruleEngine.evaluatePrompt('Quais fotos comprovam o reaterro?', serviceId);
      expect(result.outcome).toBe('informational');
      expect(result.decision).toBeNull();
      expect(result.reasoningSummary).toContain('execução por camadas');
    }
  });

  it('explica compactação informal sem transformar procedimento em decisão', () => {
    const result = ruleEngine.evaluatePrompt(
      'Não mostrou compactando a vala camada por camada.',
      'reaterro-valas-terra'
    );

    expect(result.decision).toBeNull();
    expect(result.matchedRules.some((rule) => rule.id === 'RULE-RV-INFO-02')).toBe(true);
    expect(result.requiresHumanValidation).toBe(true);
  });

  it('diferencia troca exclusiva do registro de reparo do cavalete', () => {
    const onlyRegister = ruleEngine.evaluatePrompt(
      'Qual serviço usar quando foi trocado apenas o registro?',
      selectedServiceId
    );
    const otherParts = ruleEngine.evaluatePrompt(
      'Qual serviço usar quando trocaram o registro e o tubete?',
      selectedServiceId
    );

    expect(onlyRegister.outcome).toBe('informational');
    expect(onlyRegister.reasoningSummary).toContain('Substituição de Registro de Cavalete');
    expect(otherParts.outcome).toBe('informational');
    expect(otherParts.reasoningSummary).toContain('Mantenha Reparo de Cavalete');
  });

  it('orienta cavalete mais ramal como reparo de ramal executado', () => {
    const result = ruleEngine.evaluatePrompt(
      'Qual serviço usar se substituiu o registro e mexeu no cavalete e no ramal?',
      selectedServiceId
    );

    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.reasoningSummary).toContain('Adicional Executado');
  });

  it('orienta intervenção exclusiva no ramal como Reparo de Ramal', () => {
    const result = ruleEngine.evaluatePrompt(
      'Qual serviço usar se mexeu somente no ramal?',
      selectedServiceId
    );

    expect(result.outcome).toBe('informational');
    expect(result.decision).toBeNull();
    expect(result.reasoningSummary).toContain('Use Reparo de Ramal');
  });

  it('separa Substituição de HD com e sem custo pela responsabilidade', () => {
    const withCost = ruleEngine.evaluatePrompt(
      'Qual serviço usar? O cliente quebrou o hidrômetro.',
      selectedServiceId
    );
    const withoutCost = ruleEngine.evaluatePrompt(
      'Qual serviço usar quando o hidrômetro foi furtado?',
      selectedServiceId
    );

    expect(withCost.outcome).toBe('informational');
    expect(withCost.reasoningSummary).toContain('HD com Custo');
    expect(withCost.matchedRules.some((rule) => rule.id === 'RULE-HD-SEM-CUSTO-INFO-01'))
      .toBe(false);
    expect(withoutCost.outcome).toBe('informational');
    expect(withoutCost.reasoningSummary).toContain('HD sem Custo');
  });

  it('permite consultar as novas Substituições de HD como serviços originais', () => {
    const withCost = ruleEngine.evaluatePrompt(
      'Quando a substituição do hidrômetro é com custo?',
      'substituicao-hd-com-custo'
    );
    const withoutCost = ruleEngine.evaluatePrompt(
      'Hidrômetro furtado é sem custo?',
      'substituicao-hd-sem-custo'
    );

    expect(withCost.errorCode).toBeUndefined();
    expect(withCost.reasoningSummary).toContain('atribuída ao cliente');
    expect(withoutCost.errorCode).toBeUndefined();
    expect(withoutCost.reasoningSummary).toContain('sem Custo');
  });

  it('normaliza texto com e sem acentos', () => {
    const withAccent = ruleEngine.evaluatePrompt('Sem hidrômetro.', selectedServiceId);
    const withoutAccent = ruleEngine.evaluatePrompt('Sem hidrometro.', selectedServiceId);
    expect(withAccent.decision).toBe('Não Conforme');
    expect(withoutAccent.decision).toBe(withAccent.decision);
  });

  it('normaliza caixa alta e pontuação', () => {
    const result = ruleEngine.evaluatePrompt('SEM FOTO DEPOIS!!!', selectedServiceId);
    expect(result.decision).toBe('Reprovado');
    expect(result.normalizedQuery).toBe('sem foto depois');
  });
});

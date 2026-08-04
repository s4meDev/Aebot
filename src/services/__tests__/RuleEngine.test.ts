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

  it('retorna erro controlado para serviceId inexistente', () => {
    const result = ruleEngine.evaluatePrompt('Sem foto depois.', 'servico-inexistente');
    expect(result.decision).toBeNull();
    expect(result.errorCode).toBe('SERVICE_NOT_FOUND');
    expect(result.outcome).toBe('insufficient');
    expect(result.insufficiencyReason).toBe('service_not_found');
    expect(result.requiresHumanValidation).toBe(true);
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

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
    version: 'test',
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
    expect(result.matchedRules).toHaveLength(0);
  });

  it('respeita um sinal explícito que nega a ausência', () => {
    const result = ruleEngine.evaluatePrompt('Não faltou foto depois.', selectedServiceId);
    expect(result.decision).toBeNull();
    expect(result.matchedRules).toHaveLength(0);
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
  });

  it('reconhece relato afirmativo de ausência de evidência', () => {
    const result = ruleEngine.evaluatePrompt('A foto depois não foi apresentada.', selectedServiceId);
    expect(result.intent).toBe('relato_afirmativo');
    expect(result.decision).toBe('Reprovado');
    expect(result.matchedRules.length).toBeGreaterThan(0);
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

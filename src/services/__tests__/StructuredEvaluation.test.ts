import { describe, expect, it } from 'vitest';
import type { DataRule, RuleStoreSchema, SemanticRuleMapping } from '../../types';
import { RuleEngine, ruleEngine } from '../RuleEngine';
import { normalizeText } from '../TextNormalizer';

// Catálogo pequeno de teste: o motor precisa funcionar sem conhecer os serviços reais.
function rule(id: string, overrides: Partial<DataRule> = {}): DataRule {
  return {
    id, serviceId: 'test-service', title: `Falta de evidência ${id}`,
    description: `Ausência de evidência ${id}`, severity: 'Não Conforme', priority: 2,
    conditionKeywords: [`sem evidência ${id}`], message: `Verifique a evidência ${id}.`,
    factGroup: id, ...overrides,
  };
}

function engine(rules: DataRule[]): RuleEngine {
  const store: RuleStoreSchema = {
    version: '2.0.0', conclusions: {
      Reprovado: { severity: 'Reprovado', priority: 1, description: 'Reprovado' },
      'Não Conforme': { severity: 'Não Conforme', priority: 2, description: 'Não Conforme' },
      Conforme: { severity: 'Conforme', priority: 3, description: 'Conforme' },
    },
    services: ['test-service', 'other-service'].map((id) => ({
      id, name: id, category: 'test', summary: 'Catálogo de teste.', insights: [],
    })),
    rules,
  };
  return new RuleEngine(store);
}

const query = 'Não registrou a primeira etapa.';
const secondQuery = 'Não registrou a segunda etapa.';
function mapping(id = 'alpha', overrides: Partial<SemanticRuleMapping> = {}): SemanticRuleMapping {
  return { ruleId: id, sourceQuote: query, canonicalExpression: `sem evidência ${id}`,
    stance: 'asserted', ...overrides };
}
function aggregate(overrides: Partial<DataRule> = {}): DataRule {
  return rule('aggregate', { severity: 'Reprovado', priority: 1, conditionKeywords: [],
    matchPolicy: { minimumMatchedFactGroups: { count: 2, groups: ['alpha', 'beta'] } },
    ...overrides });
}

describe('entrada estruturada no motor', () => {
  it('interpreta uma paráfrase mantendo o relato e a citação no resultado', () => {
    const subject = engine([rule('alpha')]);
    expect(subject.evaluatePrompt(query, 'test-service').decision).toBeNull();
    const result = subject.evaluateFacts({ serviceId: 'test-service', query, mappings: [mapping()] });
    expect(result.decision).toBe('Não Conforme');
    expect(result.normalizedQuery).toBe(normalizeText(query).value);
    expect(result.matchedRules[0].matchedTerms).toContain(query);
  });

  it('não aciona outra regra só porque ela compartilha a expressão canônica', () => {
    const subject = engine([rule('alpha'), rule('collision', {
      conditionKeywords: ['sem evidência alpha'], severity: 'Reprovado', priority: 1,
    })]);
    const result = subject.evaluateFacts({ serviceId: 'test-service', query, mappings: [mapping()] });
    expect(result.decision).toBe('Não Conforme');
    expect(result.matchedRules.map((item) => item.id)).toEqual(['alpha']);
  });

  it.each([
    { ruleId: 'invented' },
    { sourceQuote: 'Um trecho inventado que não existe.' },
    { canonicalExpression: 'uma condição inventada' },
    { stance: 'Conforme' as SemanticRuleMapping['stance'] },
  ])('recusa mapeamento inválido: %j', (overrides) => {
    const result = engine([rule('alpha')]).evaluateFacts({
      serviceId: 'test-service', query, mappings: [mapping('alpha', overrides)],
    });
    expect(result.decision).toBeNull();
  });

  it('não usa regra de outro serviço', () => {
    expect(engine([rule('alpha')]).evaluateFacts({
      serviceId: 'other-service', query, mappings: [mapping()],
    }).decision).toBeNull();
  });

  it('devolve erro controlado para serviço inexistente', () => {
    expect(engine([rule('alpha')]).evaluateFacts({
      serviceId: 'missing', query, mappings: [mapping()],
    }).errorCode).toBe('SERVICE_NOT_FOUND');
  });

  it.each(['exceptions', 'negativeSignals'] as const)('preserva %s do relato original', (field) => {
    const result = engine([rule('alpha', { [field]: ['vistoria dispensada'] })]).evaluateFacts({
      serviceId: 'test-service', query: `${query} Vistoria dispensada.`, mappings: [mapping()],
    });
    expect(result.decision).toBeNull();
  });

  it('não cria condição obrigatória usando a própria expressão cadastrada', () => {
    const subject = engine([rule('alpha', {
      conditionKeywords: ['equipe interna sem evidência alpha'], mandatoryConditions: ['equipe interna'],
    })]);
    const mappings = [mapping('alpha', { canonicalExpression: 'equipe interna sem evidência alpha' })];
    expect(subject.evaluateFacts({ serviceId: 'test-service', query, mappings }).decision).toBeNull();
    expect(subject.evaluateFacts({ serviceId: 'test-service', query: `${query} Equipe interna.`, mappings })
      .decision).toBe('Não Conforme');
  });

  it('não transforma presença em falta por sugestão do modelo', () => {
    const presentQuery = 'A evidência alpha aparece na OS.';
    expect(engine([rule('alpha')]).evaluateFacts({ serviceId: 'test-service', query: presentQuery,
      mappings: [mapping('alpha', { sourceQuote: presentQuery })] }).decision).toBeNull();
  });

  it('mantém pergunta informativa sem classificar uma OS', () => {
    const question = 'Precisa mesmo registrar a primeira etapa?';
    const result = engine([rule('alpha')]).evaluateFacts({ serviceId: 'test-service', query: question,
      mappings: [mapping('alpha', { sourceQuote: question })] });
    expect(result.decision).toBeNull();
    expect(result.outcome).toBe('informational');
  });

  it('identifica hipótese mesmo quando o modelo declara fato real', () => {
    const question = 'Se não registrou a primeira etapa, o que faço?';
    const result = engine([rule('alpha')]).evaluateFacts({ serviceId: 'test-service', query: question,
      mappings: [mapping('alpha', { sourceQuote: 'não registrou a primeira etapa' })] });
    expect(result.intent).toBe('hipotese');
    expect(result.reasoningSummary).toContain('No cenário descrito');
  });

  it('calcula a combinação de fatos no motor e registra quais regras a sustentam', () => {
    const result = engine([rule('alpha'), rule('beta'), aggregate()]).evaluateFacts({
      serviceId: 'test-service', query: `${query} ${secondQuery}`,
      mappings: [mapping(), mapping('beta', { sourceQuote: secondQuery })],
    });
    expect(result.decision).toBe('Reprovado');
    expect(result.primaryRule?.supportingRuleIds).toEqual(['alpha', 'beta']);
    expect(result.matchedRules).toHaveLength(3);
  });

  it('não conta duas citações do mesmo grupo como dois fatos distintos', () => {
    const result = engine([rule('alpha'), rule('beta'), aggregate()]).evaluateFacts({
      serviceId: 'test-service', query: `${query} ${secondQuery}`,
      mappings: [mapping(), mapping('alpha', { sourceQuote: secondQuery })],
    });
    expect(result.decision).toBe('Não Conforme');
    expect(result.matchedRules).toHaveLength(1);
  });

  it('não deixa o modelo escolher diretamente uma regra agregadora', () => {
    const result = engine([rule('alpha'), rule('beta'), aggregate({
      conditionKeywords: ['sem evidência completa'],
    })]).evaluateFacts({ serviceId: 'test-service', query,
      mappings: [mapping('aggregate', { canonicalExpression: 'sem evidência completa' })] });
    expect(result.decision).toBeNull();
  });

  it('não combina como ausência uma regra com mapeamentos contraditórios', () => {
    const present = 'A evidência alpha aparece na OS.';
    const result = engine([rule('alpha'), rule('beta'), aggregate()]).evaluateFacts({
      serviceId: 'test-service', query: `${query} ${present} ${secondQuery}`,
      mappings: [mapping(), mapping('alpha', { sourceQuote: present }),
        mapping('beta', { sourceQuote: secondQuery })],
    });
    expect(result.decision).toBe('Não Conforme');
    expect(result.matchedRules.map((item) => item.id)).toEqual(['beta']);
  });

  it('resolve conflito de gravidade somente entre regras realmente mapeadas', () => {
    const result = engine([rule('alpha'), rule('beta', { severity: 'Reprovado' })]).evaluateFacts({
      serviceId: 'test-service', query: `${query} ${secondQuery}`,
      mappings: [mapping(), mapping('beta', { sourceQuote: secondQuery })],
    });
    expect(result.decision).toBe('Reprovado');
    expect(result.conflicts[0]?.winnerRuleId).toBe('beta');
  });

  it('mantém serviço com regras pendentes sem decisão', () => {
    const pending = ruleEngine.getServices().find((item) => item.analysisStatus === 'rules_pending')!;
    const result = ruleEngine.evaluateFacts({ serviceId: pending.id, query, mappings: [mapping()] });
    expect(result.decision).toBeNull();
    expect(result.errorCode).toBe('SERVICE_RULES_PENDING');
  });

  it.each([
    { exceptions: ['vistoria dispensada'] },
    { negativeSignals: ['vistoria dispensada'] },
    { mandatoryConditions: ['equipe interna'] },
  ])('respeita restrições também na combinação de regras: %j', (constraints) => {
    const subject = engine([rule('alpha'), rule('beta'), aggregate(constraints)]);
    const literal = subject.evaluatePrompt(
      'Sem evidência alpha e sem evidência beta. Vistoria dispensada.', 'test-service'
    );
    const semantic = subject.evaluateFacts({ serviceId: 'test-service',
      query: `${query} ${secondQuery} Vistoria dispensada.`,
      mappings: [mapping(), mapping('beta', { sourceQuote: secondQuery })] });
    expect(literal.decision).toBe('Não Conforme');
    expect(semantic.decision).toBe('Não Conforme');
  });

  it('mantém o caminho literal quando não existem fatos interpretados', () => {
    const subject = engine([rule('alpha')]);
    const literal = 'Sem evidência alpha.';
    expect(subject.evaluateFacts({ serviceId: 'test-service', query: literal, mappings: [] }))
      .toEqual(subject.evaluatePrompt(literal, 'test-service'));
  });

  it('preserva o caso real de duas etapas ausentes sem acoplar o motor aos IDs', () => {
    const service = ruleEngine.getServices()[0];
    const rules = ruleEngine.getRulesForService(service.id);
    const before = rules.find((item) => item.conditionKeywords.includes('sem foto antes'))!;
    const during = rules.find((item) => item.conditionKeywords.includes('sem foto durante'))!;
    const result = ruleEngine.evaluateFacts({ serviceId: service.id,
      query: 'Não registrou o estado inicial. Não mostrou o aperto da virola.',
      mappings: [
        { ruleId: before.id, sourceQuote: 'Não registrou o estado inicial.',
          canonicalExpression: 'sem foto antes', stance: 'asserted' },
        { ruleId: during.id, sourceQuote: 'Não mostrou o aperto da virola.',
          canonicalExpression: 'sem foto durante', stance: 'asserted' },
      ] });
    expect(result.decision).toBe('Reprovado');
    expect(result.primaryRule?.supportingRuleIds).toEqual([before.id, during.id]);
  });
});

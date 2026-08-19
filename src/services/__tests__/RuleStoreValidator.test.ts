import { describe, expect, it } from 'vitest';
import rulesStoreData from '../../data/rulesStore.json';
import {
  CURRENT_RULE_STORE_VERSION,
  parseRuleStore,
  RuleStoreValidationError,
} from '../RuleStoreValidator';

function cloneStore(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(rulesStoreData)) as Record<string, unknown>;
}

describe('RuleStoreValidator', () => {
  it('aceita e tipa a base atual', () => {
    const store = parseRuleStore(rulesStoreData);
    expect(store.version).toBe(CURRENT_RULE_STORE_VERSION);
    expect(store.services.length).toBeGreaterThan(0);
    expect(store.rules.length).toBeGreaterThan(0);
    expect(store.rules.some((rule) => rule.severity === undefined)).toBe(true);
    expect(store.rules.some((rule) => rule.sourceReferences?.length)).toBe(true);
    expect(store.rules.some((rule) => rule.missingInformation?.length)).toBe(true);
    expect(store.services).toHaveLength(36);
    expect(store.services.filter((service) => service.analysisStatus === 'rules_pending'))
      .toHaveLength(11);
    expect(store.rules.some((rule) => rule.applicableServiceIds?.length)).toBe(true);
    const repair = store.services.find((service) => service.id === 'reparo-cavalete');
    expect(repair?.parameterization?.serviceExchange).toHaveLength(10);
    expect(repair?.parameterization?.executedAdditional).toHaveLength(9);
    expect(repair?.parameterization?.subsequentAdditional).toHaveLength(16);
    expect(store.services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'substituicao-hd-com-custo', analysisStatus: 'active' }),
      expect.objectContaining({ id: 'substituicao-hd-sem-custo', analysisStatus: 'active' }),
    ]));
  });

  it('rejeita parametrização com serviço inexistente ou repetido', () => {
    const store = cloneStore();
    const services = store.services as Array<Record<string, unknown>>;
    services[0].parameterization = {
      serviceExchange: ['servico-inexistente', 'servico-inexistente'],
    };
    expect(() => parseRuleStore(store)).toThrow(/duplicados|inexistente/);
  });

  it('exige o rótulo visível quando o nome precisa de confirmação', () => {
    const store = cloneStore();
    const services = store.services as Array<Record<string, unknown>>;
    services[1].catalogNameStatus = 'needs_confirmation';
    delete services[1].sourceLabel;
    expect(() => parseRuleStore(store)).toThrow(/sourceLabel/);
  });

  it('rejeita uma quarta conclusão oficial', () => {
    const store = cloneStore();
    const conclusions = store.conclusions as Record<string, unknown>;
    conclusions['Análise Manual'] = {
      severity: 'Análise Manual',
      priority: 4,
      description: 'Inválida',
    };
    expect(() => parseRuleStore(store)).toThrow(RuleStoreValidationError);
  });

  it('rejeita IDs duplicados e referências a serviço inexistente', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    rules.push({ ...rules[0], serviceId: 'inexistente' });
    expect(() => parseRuleStore(store)).toThrow(/duplicado|inexistente/);
  });

  it('rejeita serviço compartilhado inexistente ou repetido na regra', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    rules[0].applicableServiceIds = [rules[0].serviceId, 'servico-inexistente'];
    expect(() => parseRuleStore(store)).toThrow(/applicableServiceIds|aplicável inexistente/);
  });

  it('rejeita hierarquia oficial de gravidade invertida', () => {
    const store = cloneStore();
    const conclusions = store.conclusions as Record<string, Record<string, unknown>>;
    conclusions.Reprovado.priority = 3;
    conclusions.Conforme.priority = 1;
    expect(() => parseRuleStore(store)).toThrow(/prioridades das conclusões/);
  });

  it('valida palavras temáticas opcionais das regras', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    rules[0].topicKeywords = ['tema válido', ''];
    expect(() => parseRuleStore(store)).toThrow(/topicKeywords/);
  });

  it('valida referências documentais opcionais das regras', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    rules[0].sourceReferences = ['fonte válida', ''];
    expect(() => parseRuleStore(store)).toThrow(/sourceReferences/);
  });

  it('rejeita nível de atenção inválido e campos digitados errado', () => {
    const invalidAttention = cloneStore();
    const invalidRules = invalidAttention.rules as Array<Record<string, unknown>>;
    invalidRules[0].attentionLevel = 'urgente';
    expect(() => parseRuleStore(invalidAttention)).toThrow(/attentionLevel/);

    const misspelledField = cloneStore();
    const misspelledRules = misspelledField.rules as Array<Record<string, unknown>>;
    misspelledRules[0].equivalentExpresions = ['erro de digitação'];
    expect(() => parseRuleStore(misspelledField)).toThrow(/não é um campo suportado/);
  });

  it('não permite misturar escopo geral com lista manual de serviços', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    rules[0].appliesToAllActiveServices = true;
    rules[0].applicableServiceIds = ['reparo-ramal-agua-asfalto'];

    expect(() => parseRuleStore(store)).toThrow(/appliesToAllActiveServices/);
  });

  it('rejeita regra agregadora que referencia grupo factual inexistente', () => {
    const store = cloneStore();
    const rules = store.rules as Array<Record<string, unknown>>;
    const aggregate = rules.find((rule) => rule.id === 'RULE-RC-02');
    expect(aggregate).toBeTruthy();
    aggregate!.matchPolicy = {
      minimumMatchedFactGroups: { count: 2, groups: ['antes', 'grupo-inexistente'] },
    };

    expect(() => parseRuleStore(store)).toThrow(/factGroup inexistente/);
  });

  it('migra base legada v1 removendo decisão padrão e conclusão extra', () => {
    const store = cloneStore();
    store.version = '1.0.0';
    const services = store.services as Array<Record<string, unknown>>;
    services[0].decisionDefault = 'Conforme';
    const conclusions = store.conclusions as Record<string, unknown>;
    conclusions['Análise Manual'] = {
      severity: 'Análise Manual',
      priority: 4,
      description: 'Legada',
    };

    const migrated = parseRuleStore(store);
    expect(migrated.version).toBe(CURRENT_RULE_STORE_VERSION);
    expect(migrated.services[0]).not.toHaveProperty('decisionDefault');
    expect(migrated.conclusions).not.toHaveProperty('Análise Manual');
  });
});

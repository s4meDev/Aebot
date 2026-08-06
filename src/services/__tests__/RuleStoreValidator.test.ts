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

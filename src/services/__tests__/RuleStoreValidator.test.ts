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

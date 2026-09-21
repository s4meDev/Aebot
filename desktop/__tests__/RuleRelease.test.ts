import { describe, expect, it } from 'vitest';
import store from '../../src/data/rulesStore.json';
import { parseRuleRelease } from '../RuleRelease';
const release = { format: 'aebot-rule-release-v1', owner: 'Responsável do piloto',
  effectiveAt: '2026-09-01T00:00:00Z', changes: 'Revisão operacional para teste.', store };
describe('governança das regras desktop', () => {
  it('valida pacote com origem operacional declarada', () => {
    expect(parseRuleRelease(release).store.version).toBe(store.version);
  });
  it('bloqueia downgrade, mesma versão, futuro e propriedades desconhecidas', () => {
    expect(() => parseRuleRelease(release, store.version)).toThrow('maior');
    expect(() => parseRuleRelease(release, '99.0.0')).toThrow('maior');
    expect(() => parseRuleRelease({ ...release, effectiveAt: '2999-01-01' })).toThrow('vigência');
    expect(() => parseRuleRelease({ ...release, script: 'injetado' })).toThrow('Formato');
  });
  it('valida também os contratos e referências do motor', () => {
    expect(() => parseRuleRelease({ ...release, store: { ...store, rules: [{ ...store.rules[0], serviceId: 'inexistente' }] } })).toThrow();
  });
});

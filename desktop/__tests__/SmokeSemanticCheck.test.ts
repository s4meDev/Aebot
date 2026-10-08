import { describe, expect, it } from 'vitest';
import { validateSemanticSmokeCheck, type SemanticSmokeRecord } from '../SmokeSemanticCheck';

const expected = { decision: 'Reprovado' as const, ruleIds: ['regra-sintetica'] };
const record: SemanticSmokeRecord = { decision: 'Reprovado', provider: 'local', semanticApplied: true,
  ruleIds: expected.ruleIds, durationMs: 100, calls: 1, errors: 0 };

describe('inferência real pela ponte pública do pacote', () => {
  it('confere o resultado sem exigir tentativas privadas no renderer', () => {
    expect(validateSemanticSmokeCheck(record, expected)).toEqual({ decision: 'Reprovado', ruleIds: expected.ruleIds,
      durationMs: 100, modelCalls: 1 });
  });
  it.each([{ calls: 0 }, { calls: 0.5 }, { errors: 1 }, { semanticApplied: false }, { provider: 'simulated' },
    { decision: null }, { ruleIds: ['outra'] }, { ruleIds: [] }, { fallbackReason: 'invalid_response' },
    { durationMs: NaN }])('recusa falso acerto de integração: %j', change => {
    expect(() => validateSemanticSmokeCheck({ ...record, ...change }, expected)).toThrow();
  });
});

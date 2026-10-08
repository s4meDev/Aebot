import type { DecisionType } from '../src/types';

export interface SemanticSmokeRecord {
  decision: DecisionType | null;
  provider: string;
  semanticApplied: boolean;
  fallbackReason?: string;
  ruleIds: string[];
  durationMs: number;
  calls: number;
  errors: number;
}

/** A ponte não expõe tentativas internas. Confiro inferência pelos contadores e pelo resultado público. */
export function validateSemanticSmokeCheck(record: SemanticSmokeRecord,
  expected: { decision: DecisionType | null; ruleIds: string[] }) {
  if (record.decision !== expected.decision || record.provider !== 'local' || !record.semanticApplied ||
      ['api_error', 'rate_limited', 'invalid_response'].includes(record.fallbackReason ?? '') ||
      !Number.isSafeInteger(record.calls) || record.calls < 1 || record.errors !== 0 ||
      !Number.isFinite(record.durationMs) || record.durationMs < 0 ||
      record.ruleIds.length !== expected.ruleIds.length || expected.ruleIds.some(id => !record.ruleIds.includes(id))) {
    throw new Error('Inferência semântica do pacote divergiu do corpus.');
  }
  return { decision: record.decision, ruleIds: record.ruleIds, durationMs: record.durationMs, modelCalls: record.calls };
}

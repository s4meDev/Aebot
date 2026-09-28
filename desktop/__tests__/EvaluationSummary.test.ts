import { describe, expect, it } from 'vitest';
import { summarizeEvaluation, type EvaluationRowMetrics } from '../EvaluationSummary';

const row = (overrides: Partial<EvaluationRowMetrics> = {}): EvaluationRowMetrics => ({
  passed: true, unsafeApproval: false, missedRejection: false, durationMs: 10, attempts: [], ...overrides,
});

describe('relatório técnico do piloto', () => {
  it('não inventa latência ou consumo em uma rodada vazia', () => {
    const summary = summarizeEvaluation([]);
    expect(summary.evaluated).toBe(0);
    expect(summary.latency.allCases).toEqual({ count: 0, medianMs: null, p95Ms: null, maxMs: null });
    expect(summary.inputTokens).toEqual({ reportedCalls: 0, total: null });
  });
  it('separa a latência dos casos com chamadas ao modelo', () => {
    const summary = summarizeEvaluation([row(), row({ durationMs: 30 }), row({ durationMs: 120000,
      attempts: [{ provider: 'local', model: 'Qwen', status: 'ok', durationMs: 119000 }] })]);
    expect(summary.latency.allCases).toEqual({ count: 3, medianMs: 30, p95Ms: 120000, maxMs: 120000 });
    expect(summary.latency.withoutModelCalls.medianMs).toBe(20);
    expect(summary.latency.withModelCalls.count).toBe(1);
  });
  it('conta erros e consumo reportado mesmo quando a saída é inválida', () => {
    const summary = summarizeEvaluation([row({ passed: false, missedRejection: true, attempts: [
      { provider: 'local', model: 'Qwen', status: 'invalid_response', durationMs: 12, inputTokens: 50, outputTokens: 0 },
      { provider: 'local', model: 'Qwen', status: 'api_error', durationMs: 2 },
    ] }), row({ passed: false, unsafeApproval: true })]);
    expect(summary).toMatchObject({ divergences: 2, missedRejections: 1, unsafeApprovals: 1, modelCalls: 2, modelErrors: 2 });
    expect(summary.inputTokens).toEqual({ reportedCalls: 1, total: 50 });
    expect(summary.outputTokens).toEqual({ reportedCalls: 1, total: 0 });
  });
});

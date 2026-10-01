import { describe, expect, it } from 'vitest';
import { evaluationProgress, summarizeEvaluation, type EvaluationRowMetrics } from '../EvaluationSummary';

const row = (overrides: Partial<EvaluationRowMetrics> = {}): EvaluationRowMetrics => ({
  passed: true, unsafeApproval: false, missedRejection: false, durationMs: 10, attempts: [], ...overrides,
});

describe('relatório técnico do piloto', () => {
  it('registra início e falha sem inventar casos executados', () => {
    for (const status of ['starting', 'failed'] as const) {
      expect(evaluationProgress([], 6, status)).toMatchObject({ status, completed: false,
        expectedCases: 6, summary: { evaluated: 0, passed: 0, modelCalls: 0 } });
    }
  });
  it('mantém resultados parciais sem declarar a rodada completa', () => {
    expect(evaluationProgress([row()], 6, 'failed')).toMatchObject({ completed: false,
      summary: { evaluated: 1, passed: 1 } });
    expect(evaluationProgress([row()], 6, 'running').completed).toBe(false);
  });
  it('concluir a execução não significa acertar todos os casos', () => {
    expect(evaluationProgress([row({ passed: false })], 1, 'completed')).toMatchObject({
      completed: true, summary: { evaluated: 1, divergences: 1 },
    });
  });
  it('recusa conclusão prematura e contagens inconsistentes', () => {
    expect(() => evaluationProgress([], 6, 'completed')).toThrow();
    expect(() => evaluationProgress([row()], 6, 'starting')).toThrow();
    expect(() => evaluationProgress([row(), row()], 1, 'running')).toThrow();
    expect(() => evaluationProgress([], 0, 'starting')).toThrow();
  });
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

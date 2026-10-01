import type { AiModelAttempt } from '../src/types';

export interface EvaluationRowMetrics {
  passed: boolean;
  unsafeApproval: boolean;
  missedRejection: boolean;
  durationMs: number;
  attempts: AiModelAttempt[];
}

export type EvaluationRunStatus = 'starting' | 'running' | 'completed' | 'failed';

/** Uma rodada sem casos executados não pode parecer concluída ou aprovada. */
export function evaluationProgress(rows: EvaluationRowMetrics[], expectedCases: number, status: EvaluationRunStatus) {
  if (!Number.isSafeInteger(expectedCases) || expectedCases < 1 || rows.length > expectedCases ||
      status === 'completed' && rows.length !== expectedCases || status === 'starting' && rows.length !== 0) {
    throw new Error('Progresso inconsistente na avaliação.');
  }
  return { status, completed: status === 'completed', expectedCases, summary: summarizeEvaluation(rows) };
}

function latency(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  // P95 por posição: em amostras pequenas ele pode ser o maior tempo observado.
  return { count: sorted.length,
    medianMs: sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null };
}

/** Resume a rodada técnica; nenhum número aqui representa homologação de negócio. */
export function summarizeEvaluation(rows: EvaluationRowMetrics[]) {
  const attempts = rows.flatMap((row) => row.attempts);
  const tokenCounts = (key: 'inputTokens' | 'outputTokens') => {
    const reported = attempts.map((attempt) => attempt[key]).filter((value): value is number =>
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
    // Ausência de medição não significa consumo zero.
    return { reportedCalls: reported.length, total: reported.length ? reported.reduce((a, b) => a + b, 0) : null };
  };
  return {
    evaluated: rows.length, passed: rows.filter((row) => row.passed).length,
    divergences: rows.filter((row) => !row.passed).length,
    unsafeApprovals: rows.filter((row) => row.unsafeApproval).length,
    missedRejections: rows.filter((row) => row.missedRejection).length,
    modelCalls: attempts.length, modelErrors: attempts.filter((attempt) => attempt.status !== 'ok').length,
    inputTokens: tokenCounts('inputTokens'), outputTokens: tokenCounts('outputTokens'),
    latency: { allCases: latency(rows.map((row) => row.durationMs)),
      withModelCalls: latency(rows.filter((row) => row.attempts.length > 0).map((row) => row.durationMs)),
      withoutModelCalls: latency(rows.filter((row) => row.attempts.length === 0).map((row) => row.durationMs)) },
  };
}

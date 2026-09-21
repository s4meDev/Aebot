import type { AiModelAttempt, AiProviderResponse, DecisionType } from '../src/types';
import type { D1Database } from './feedbackRepository';

interface ActivityRow {
  day: string;
  request_count: number;
  analysis_count: number;
  feedback_count: number;
  conforme_count: number;
  nao_conforme_count: number;
  reprovado_count: number;
  no_decision_count: number;
  ai_response_count: number;
  local_response_count: number;
  duration_ms_total: number;
  active_analysts: number;
}

interface ModelRow {
  day: string;
  provider: AiModelAttempt['provider'];
  model: string;
  status: AiModelAttempt['status'];
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms_total: number;
  duration_ms_max: number;
  last_seen_at: string;
}

interface AnalystRow {
  analyst_id: string;
  request_count: number;
  analysis_count: number;
  feedback_count: number;
  last_seen_at: string;
}

export interface OperationalMetrics {
  period: { startDay: string; endDay: string; days: number; timezone: 'UTC' };
  totals: {
    requests: number;
    analyses: number;
    feedbacks: number;
    activeAnalysts: number;
    decisions: Record<'conforme' | 'naoConforme' | 'reprovado' | 'semDecisao', number>;
    aiResponses: number;
    localResponses: number;
    averageAnalysisDurationMs: number | null;
  };
  daily: ActivityRow[];
  models: ModelRow[];
  analysts: AnalystRow[];
}

function countForDecision(decision: DecisionType | null, expected: DecisionType): number {
  return decision === expected ? 1 : 0;
}

async function writeActivity(
  database: D1Database,
  values: {
    day: string;
    analystId: string;
    requestCount: number;
    analysisCount: number;
    feedbackCount: number;
    conformeCount: number;
    naoConformeCount: number;
    reprovadoCount: number;
    noDecisionCount: number;
    aiResponseCount: number;
    localResponseCount: number;
    durationMs: number;
    occurredAt: string;
  }
): Promise<void> {
  const result = await database.prepare(`
    INSERT INTO analyst_activity_metrics (
      day, analyst_id, request_count, analysis_count, feedback_count,
      conforme_count, nao_conforme_count, reprovado_count, no_decision_count,
      ai_response_count, local_response_count, duration_ms_total, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, analyst_id) DO UPDATE SET
      request_count = request_count + excluded.request_count,
      analysis_count = analysis_count + excluded.analysis_count,
      feedback_count = feedback_count + excluded.feedback_count,
      conforme_count = conforme_count + excluded.conforme_count,
      nao_conforme_count = nao_conforme_count + excluded.nao_conforme_count,
      reprovado_count = reprovado_count + excluded.reprovado_count,
      no_decision_count = no_decision_count + excluded.no_decision_count,
      ai_response_count = ai_response_count + excluded.ai_response_count,
      local_response_count = local_response_count + excluded.local_response_count,
      duration_ms_total = duration_ms_total + excluded.duration_ms_total,
      last_seen_at = excluded.last_seen_at
  `).bind(
    values.day,
    values.analystId,
    values.requestCount,
    values.analysisCount,
    values.feedbackCount,
    values.conformeCount,
    values.naoConformeCount,
    values.reprovadoCount,
    values.noDecisionCount,
    values.aiResponseCount,
    values.localResponseCount,
    values.durationMs,
    values.occurredAt
  ).run();
  if (!result.success) throw new Error('activity_metric_write_failed');
}

export async function recordAnalysisMetrics(
  database: D1Database,
  input: { analystId: string; occurredAt: string; durationMs: number; result: AiProviderResponse }
): Promise<void> {
  const day = input.occurredAt.slice(0, 10);
  await writeActivity(database, {
    day,
    analystId: input.analystId,
    requestCount: 1,
    analysisCount: 1,
    feedbackCount: 0,
    conformeCount: countForDecision(input.result.decision, 'Conforme'),
    naoConformeCount: countForDecision(input.result.decision, 'Não Conforme'),
    reprovadoCount: countForDecision(input.result.decision, 'Reprovado'),
    noDecisionCount: input.result.decision === null ? 1 : 0,
    aiResponseCount: input.result.provider === 'simulated' ? 0 : 1,
    localResponseCount: input.result.provider === 'simulated' ? 1 : 0,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    occurredAt: input.occurredAt,
  });

  for (const attempt of input.result.modelAttempts ?? []) {
    const result = await database.prepare(`
      INSERT INTO ai_attempt_metrics (
        day, analyst_id, provider, model, status, request_count,
        input_tokens, output_tokens, duration_ms_total, duration_ms_max, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(day, analyst_id, provider, model, status) DO UPDATE SET
        request_count = request_count + 1,
        input_tokens = input_tokens + excluded.input_tokens,
        output_tokens = output_tokens + excluded.output_tokens,
        duration_ms_total = duration_ms_total + excluded.duration_ms_total,
        duration_ms_max = MAX(duration_ms_max, excluded.duration_ms_max),
        last_seen_at = excluded.last_seen_at
    `).bind(
      day,
      input.analystId,
      attempt.provider,
      attempt.model,
      attempt.status,
      Math.max(0, attempt.inputTokens ?? 0),
      Math.max(0, attempt.outputTokens ?? 0),
      Math.max(0, Math.round(attempt.durationMs)),
      Math.max(0, Math.round(attempt.durationMs)),
      input.occurredAt
    ).run();
    if (!result.success) throw new Error('ai_metric_write_failed');
  }
}

export async function recordFeedbackMetrics(
  database: D1Database,
  input: { analystId: string; occurredAt: string }
): Promise<void> {
  await writeActivity(database, {
    day: input.occurredAt.slice(0, 10),
    analystId: input.analystId,
    requestCount: 1,
    analysisCount: 0,
    feedbackCount: 1,
    conformeCount: 0,
    naoConformeCount: 0,
    reprovadoCount: 0,
    noDecisionCount: 0,
    aiResponseCount: 0,
    localResponseCount: 0,
    durationMs: 0,
    occurredAt: input.occurredAt,
  });
}

export async function getOperationalMetrics(
  database: D1Database,
  options: { startDay: string; endDay: string; days: number }
): Promise<OperationalMetrics> {
  const [dailyResult, modelsResult, analystsResult] = await Promise.all([
    database.prepare(`
      SELECT day,
        SUM(request_count) AS request_count,
        SUM(analysis_count) AS analysis_count,
        SUM(feedback_count) AS feedback_count,
        SUM(conforme_count) AS conforme_count,
        SUM(nao_conforme_count) AS nao_conforme_count,
        SUM(reprovado_count) AS reprovado_count,
        SUM(no_decision_count) AS no_decision_count,
        SUM(ai_response_count) AS ai_response_count,
        SUM(local_response_count) AS local_response_count,
        SUM(duration_ms_total) AS duration_ms_total,
        COUNT(DISTINCT analyst_id) AS active_analysts
      FROM analyst_activity_metrics
      WHERE day BETWEEN ? AND ?
      GROUP BY day ORDER BY day DESC
    `).bind(options.startDay, options.endDay).all<ActivityRow>(),
    database.prepare(`
      SELECT day, provider, model, status,
        SUM(request_count) AS request_count,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(duration_ms_total) AS duration_ms_total,
        MAX(duration_ms_max) AS duration_ms_max,
        MAX(last_seen_at) AS last_seen_at
      FROM ai_attempt_metrics
      WHERE day BETWEEN ? AND ?
      GROUP BY day, provider, model, status
      ORDER BY day DESC, provider, model, status
    `).bind(options.startDay, options.endDay).all<ModelRow>(),
    database.prepare(`
      SELECT analyst_id,
        SUM(request_count) AS request_count,
        SUM(analysis_count) AS analysis_count,
        SUM(feedback_count) AS feedback_count,
        MAX(last_seen_at) AS last_seen_at
      FROM analyst_activity_metrics
      WHERE day BETWEEN ? AND ?
      GROUP BY analyst_id ORDER BY analysis_count DESC, analyst_id ASC
    `).bind(options.startDay, options.endDay).all<AnalystRow>(),
  ]);
  if (!dailyResult.success || !modelsResult.success || !analystsResult.success) {
    throw new Error('operational_metrics_read_failed');
  }

  const totals = dailyResult.results.reduce((sum, row) => ({
    requests: sum.requests + Number(row.request_count),
    analyses: sum.analyses + Number(row.analysis_count),
    feedbacks: sum.feedbacks + Number(row.feedback_count),
    conforme: sum.conforme + Number(row.conforme_count),
    naoConforme: sum.naoConforme + Number(row.nao_conforme_count),
    reprovado: sum.reprovado + Number(row.reprovado_count),
    semDecisao: sum.semDecisao + Number(row.no_decision_count),
    aiResponses: sum.aiResponses + Number(row.ai_response_count),
    localResponses: sum.localResponses + Number(row.local_response_count),
    durationMs: sum.durationMs + Number(row.duration_ms_total),
  }), {
    requests: 0, analyses: 0, feedbacks: 0, conforme: 0, naoConforme: 0,
    reprovado: 0, semDecisao: 0, aiResponses: 0, localResponses: 0, durationMs: 0,
  });

  return {
    period: { ...options, timezone: 'UTC' },
    totals: {
      requests: totals.requests,
      analyses: totals.analyses,
      feedbacks: totals.feedbacks,
      activeAnalysts: analystsResult.results.length,
      decisions: {
        conforme: totals.conforme,
        naoConforme: totals.naoConforme,
        reprovado: totals.reprovado,
        semDecisao: totals.semDecisao,
      },
      aiResponses: totals.aiResponses,
      localResponses: totals.localResponses,
      averageAnalysisDurationMs: totals.analyses
        ? Math.round(totals.durationMs / totals.analyses)
        : null,
    },
    daily: dailyResult.results,
    models: modelsResult.results,
    analysts: analystsResult.results,
  };
}

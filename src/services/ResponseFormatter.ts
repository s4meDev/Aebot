import type { RuleEvaluationResult } from '../types';

function defaultGuidance(evaluation: RuleEvaluationResult): string {
  if (evaluation.intent === 'hipotese') {
    return 'Use esta orientação se o cenário for confirmado na Ordem de Serviço.';
  }
  return 'Registre a conclusão e as regras aplicadas na análise da Ordem de Serviço.';
}

export interface ResponseNarrative {
  justification?: string;
  guidance?: string;
}

export function formatEvaluationResponse(
  evaluation: RuleEvaluationResult,
  narrative: ResponseNarrative = {}
): string {
  if (!evaluation.decision || !evaluation.hasSufficientEvidence) {
    const reason = evaluation.errorCode === 'SERVICE_NOT_FOUND'
      ? 'O serviço selecionado não existe na base de regras.'
      : evaluation.reasoningSummary;
    return `Não foi possível recomendar uma conclusão com segurança.\n\nMotivo:\n${reason}\n\nOrientação ao analista:\nValide com o responsável e cadastre ou atualize a regra necessária na base.`;
  }

  const rules = evaluation.matchedRules
    .map((rule) => `${rule.id} — ${rule.title}`)
    .join('\n');
  const guidance = narrative.guidance ?? evaluation.primaryRule?.guidance ?? defaultGuidance(evaluation);
  const justification = narrative.justification ?? evaluation.reasoningSummary;

  return `Decisão recomendada:\n${evaluation.decision}\n\nJustificativa:\n${justification}\n\nRegras utilizadas:\n${rules}\n\nOrientação ao analista:\n${guidance}`;
}

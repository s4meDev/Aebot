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
  if (evaluation.outcome === 'informational') {
    let rules = evaluation.contextApplied
      ? 'Contexto atualizado do caso'
      : 'Cadastro do serviço selecionado';
    if (evaluation.matchedRules.length) {
      rules = evaluation.matchedRules
        .map((rule) => `${rule.id} — ${rule.title}`)
        .join('\n');
    }

    let defaultInformationalGuidance =
      'Consulte as regras cadastradas ao analisar um caso concreto e informe os fatos observados.';
    if (evaluation.primaryRule) {
      defaultInformationalGuidance =
        'Use essa orientação somente quando os fatos correspondentes forem confirmados na Ordem de Serviço.';
    } else if (evaluation.contextApplied) {
      defaultInformationalGuidance =
        'Informe os demais fatos do caso para que uma nova conclusão possa ser calculada.';
    }
    const guidance = narrative.guidance ?? defaultInformationalGuidance;
    const explanation = narrative.justification ?? evaluation.reasoningSummary;
    return `Sobre essa dúvida:\n${explanation}\n\nRegras consultadas:\n${rules}\n\nOrientação ao analista:\n${guidance}`;
  }

  if (!evaluation.decision || !evaluation.hasSufficientEvidence) {
    const guidanceOnly = evaluation.matchedRules.length > 0 &&
      evaluation.matchedRules.every((rule) => rule.severity === null);
    const hasCriticalGuidance = evaluation.matchedRules.some(
      (rule) => rule.attentionLevel === 'critical'
    );
    const reason = evaluation.errorCode === 'SERVICE_NOT_FOUND'
      ? 'O serviço selecionado não existe na base de regras.'
      : hasCriticalGuidance
        ? `Atenção crítica: ${evaluation.reasoningSummary}`
        : evaluation.reasoningSummary;
    const guidance = guidanceOnly
      ? `${evaluation.matchedRules[0].guidance ?? evaluation.matchedRules[0].message} Como não há conclusão oficial cadastrada para esse fato, valide a classificação com o responsável.`
      : evaluation.insufficiencyReason === 'missing_information'
      ? 'Informe quais evidências foram apresentadas, quais faltaram e se a execução do serviço estava correta.'
      : evaluation.insufficiencyReason === 'semantic_unavailable'
        ? 'Tente novamente. Se o problema persistir, valide o caso com o responsável; não altere a base somente por esta falha técnica.'
      : evaluation.insufficiencyReason === 'service_not_found'
        ? 'Selecione um serviço válido antes de realizar a análise.'
      : evaluation.insufficiencyReason === 'service_rules_pending'
        ? 'Valide este caso com o responsável até que as regras próprias desse serviço sejam cadastradas.'
      : evaluation.insufficiencyReason === 'backend_unavailable'
        ? 'Restabeleça o backend central ou peça suporte. Esta análise não usará uma base local possivelmente desatualizada.'
        : 'Valide com o responsável e cadastre ou atualize a regra necessária na base.';
    return `Não foi possível recomendar uma conclusão com segurança.\n\nMotivo:\n${reason}\n\nOrientação ao analista:\n${guidance}`;
  }

  const rules = evaluation.matchedRules
    .map((rule) => `${rule.id} — ${rule.title}`)
    .join('\n');
  const guidance = narrative.guidance ?? evaluation.primaryRule?.guidance ?? defaultGuidance(evaluation);
  const justification = narrative.justification ?? evaluation.reasoningSummary;

  return `Decisão recomendada:\n${evaluation.decision}\n\nJustificativa:\n${justification}\n\nRegras utilizadas:\n${rules}\n\nOrientação ao analista:\n${guidance}`;
}

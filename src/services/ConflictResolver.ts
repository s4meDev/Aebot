import type {
  DecisionType,
  EvaluationConflict,
  MatchedRule,
  RuleConclusionMeta,
  ServiceDecisionPolicy,
} from '../types';

function compareRules(
  left: MatchedRule,
  right: MatchedRule,
  conclusionPriority: Map<string, number>
): number {
  // A ordem segue o contrato do produto. Gravidade só desempata regras
  // que já provaram ter a mesma qualidade de correspondência.
  if (left.factMatchQuality !== right.factMatchQuality) {
    return right.factMatchQuality - left.factMatchQuality;
  }
  if (left.specificity !== right.specificity) return right.specificity - left.specificity;
  if (left.relevance !== right.relevance) return right.relevance - left.relevance;
  if (left.priority !== right.priority) return left.priority - right.priority;

  const severityDifference =
    ((left.severity ? conclusionPriority.get(left.severity) : undefined) ?? Number.MAX_SAFE_INTEGER) -
    ((right.severity ? conclusionPriority.get(right.severity) : undefined) ?? Number.MAX_SAFE_INTEGER);
  if (severityDifference !== 0) return severityDifference;
  return left.id.localeCompare(right.id);
}

export function resolveConflicts(
  rules: MatchedRule[],
  conclusions: RuleConclusionMeta[],
  decisionPolicy: ServiceDecisionPolicy = 'ranked'
): { rankedRules: MatchedRule[]; primaryRule: MatchedRule | null; conflicts: EvaluationConflict[] } {
  const conclusionPriority = new Map(
    conclusions.map((conclusion) => [conclusion.severity, conclusion.priority])
  );
  // Só recebe regras que passaram pelos fatos/condições. Não usa essa política
  // para promover regras apenas relacionadas ao assunto a uma reprovação.
  const rankedRules = [...rules].sort((left, right) => {
    if (decisionPolicy === 'most_severe_applicable') {
      const severity = ((left.severity ? conclusionPriority.get(left.severity) : undefined) ?? Number.MAX_SAFE_INTEGER)
        - ((right.severity ? conclusionPriority.get(right.severity) : undefined) ?? Number.MAX_SAFE_INTEGER);
      if (severity) return severity;
    }
    return compareRules(left, right, conclusionPriority);
  });
  const primaryRule = rankedRules[0] ?? null;
  const decisions = [...new Set(
    rankedRules
      .map((rule) => rule.severity)
      .filter((decision): decision is DecisionType => decision !== null)
  )];

  const conflicts: EvaluationConflict[] =
    primaryRule && decisions.length > 1
      ? [
          {
            ruleIds: rankedRules.map((rule) => rule.id),
            decisions,
            winnerRuleId: primaryRule.id,
            resolution:
              decisionPolicy === 'most_severe_applicable'
                ? 'Entre as regras realmente aplicáveis, prevaleceu a conclusão mais grave, conforme a política cadastrada do serviço.'
                : 'Prevaleceu a regra mais compatível com os fatos, específica e relevante; prioridade e gravidade foram usadas como desempate.',
          },
        ]
      : [];

  return { rankedRules, primaryRule, conflicts };
}

import type {
  EvaluationConflict,
  MatchedRule,
  RuleConclusionMeta,
} from '../types';

function compareRules(
  left: MatchedRule,
  right: MatchedRule,
  conclusionPriority: Map<string, number>
): number {
  if (left.factMatchQuality !== right.factMatchQuality) {
    return right.factMatchQuality - left.factMatchQuality;
  }
  if (left.specificity !== right.specificity) return right.specificity - left.specificity;
  if (left.relevance !== right.relevance) return right.relevance - left.relevance;
  if (left.priority !== right.priority) return left.priority - right.priority;

  const severityDifference =
    (conclusionPriority.get(left.severity) ?? Number.MAX_SAFE_INTEGER) -
    (conclusionPriority.get(right.severity) ?? Number.MAX_SAFE_INTEGER);
  if (severityDifference !== 0) return severityDifference;
  return left.id.localeCompare(right.id);
}

export function resolveConflicts(
  rules: MatchedRule[],
  conclusions: RuleConclusionMeta[]
): { rankedRules: MatchedRule[]; primaryRule: MatchedRule | null; conflicts: EvaluationConflict[] } {
  const conclusionPriority = new Map(
    conclusions.map((conclusion) => [conclusion.severity, conclusion.priority])
  );
  const rankedRules = [...rules].sort((left, right) =>
    compareRules(left, right, conclusionPriority)
  );
  const primaryRule = rankedRules[0] ?? null;
  const decisions = [...new Set(rankedRules.map((rule) => rule.severity))];

  const conflicts: EvaluationConflict[] =
    primaryRule && decisions.length > 1
      ? [
          {
            ruleIds: rankedRules.map((rule) => rule.id),
            decisions,
            winnerRuleId: primaryRule.id,
            resolution:
              'Prevaleceu a regra mais compatível com os fatos, específica e relevante; prioridade e gravidade foram usadas como desempate.',
          },
        ]
      : [];

  return { rankedRules, primaryRule, conflicts };
}

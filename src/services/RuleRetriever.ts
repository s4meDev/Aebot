import type { DataRule, MatchedRule, QueryIntent } from '../types';
import {
  findExpression,
  findExpressions,
  hasScopedPositiveSignal,
  normalizeText,
  type NormalizedText,
} from './TextNormalizer';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function expressionSpecificity(expression: string): number {
  return normalizeText(expression).tokens.length;
}

function getFactMatchQuality(intent: QueryIntent, hasDirectScenario: boolean): number {
  switch (intent) {
    case 'relato_afirmativo':
      return 1;
    case 'hipotese':
      return 0.9;
    case 'pergunta_informativa':
      return hasDirectScenario ? 0.8 : 0.45;
    default:
      return hasDirectScenario ? 0.75 : 0.6;
  }
}

function matchRule(query: NormalizedText, intent: QueryIntent, rule: DataRule): MatchedRule | null {
  const exceptionMatches = findExpressions(query, rule.exceptions);
  const negativeMatches = findExpressions(query, rule.negativeSignals);
  if (exceptionMatches.length || negativeMatches.length) return null;

  const scenarioExpressions = [
    ...rule.conditionKeywords,
    ...(rule.equivalentExpressions ?? []),
  ];
  const directMatches = findExpressions(query, scenarioExpressions);
  const signalMatches = findExpressions(query, rule.positiveSignals);
  const evidenceMatches = findExpressions(query, rule.relatedEvidence);
  const mandatoryMatches = findExpressions(query, rule.mandatoryConditions);

  if (
    rule.mandatoryConditions?.length &&
    mandatoryMatches.length !== rule.mandatoryConditions.length
  ) {
    return null;
  }

  const allOf = rule.matchPolicy?.allOf ?? [];
  const allOfMatches = findExpressions(query, allOf);
  const satisfiesAllOf = allOf.length > 0 && allOfMatches.length === allOf.length;

  const minimumGroups = rule.matchPolicy?.minimumGroups;
  const matchedGroups = minimumGroups
    ? minimumGroups.groups.filter((group) =>
        (minimumGroups.positiveSignals ?? rule.positiveSignals)?.length
          ? hasScopedPositiveSignal(
              query,
              group.expressions,
              minimumGroups.positiveSignals ?? rule.positiveSignals,
              minimumGroups.negativeSignals
            )
          : group.expressions.some((expression) => findExpression(query, expression))
      )
    : [];
  const satisfiesMinimumGroups = Boolean(
    minimumGroups && matchedGroups.length >= minimumGroups.count
  );

  const hasCompositeMatch = hasScopedPositiveSignal(
    query,
    rule.relatedEvidence,
    rule.positiveSignals,
    rule.negativeSignals
  );
  const hasDirectScenario = directMatches.length > 0;
  if (!hasDirectScenario && !hasCompositeMatch && !satisfiesAllOf && !satisfiesMinimumGroups) {
    return null;
  }

  const matchedTerms = unique([
    ...directMatches,
    ...signalMatches,
    ...evidenceMatches,
    ...allOfMatches,
    ...matchedGroups.flatMap((group) => group.expressions.filter((item) => findExpression(query, item))),
  ]);
  const matchReasons: string[] = [];
  if (directMatches.length) matchReasons.push('cenário equivalente encontrado');
  if (hasCompositeMatch) matchReasons.push('fato e evidência relacionados');
  if (satisfiesMinimumGroups) {
    matchReasons.push(`${matchedGroups.length} fatos distintos atendem à condição mínima`);
  }
  if (satisfiesAllOf) matchReasons.push('todas as condições da regra foram identificadas');
  if (mandatoryMatches.length) matchReasons.push('condições obrigatórias presentes');

  const specificity = Math.max(
    1,
    ...directMatches.map(expressionSpecificity),
    ...evidenceMatches.map(expressionSpecificity),
    allOfMatches.length,
    matchedGroups.length * 4
  );
  const factMatchQuality = getFactMatchQuality(intent, hasDirectScenario);
  const relevance = Math.min(
    1,
    0.45 +
      (hasDirectScenario ? 0.2 : 0) +
      (hasCompositeMatch ? 0.2 : 0) +
      (satisfiesMinimumGroups || satisfiesAllOf ? 0.2 : 0) +
      Math.min(specificity, 5) * 0.03
  );
  const score = Math.round(Math.min(10, relevance * 6 + factMatchQuality * 2 + specificity * 0.4) * 10) / 10;

  return {
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    priority: rule.priority,
    score,
    factMatchQuality,
    specificity,
    relevance,
    matchReasons,
    matchedTerms,
    guidance: rule.guidance,
    message: rule.message,
  };
}

export function retrieveRules(
  query: NormalizedText,
  intent: QueryIntent,
  rules: DataRule[]
): MatchedRule[] {
  return rules.flatMap((rule) => {
    const match = matchRule(query, intent, rule);
    return match ? [match] : [];
  });
}

function matchInformationalRule(query: NormalizedText, rule: DataRule): MatchedRule | null {
  const lastSegment = query.segments[query.segments.length - 1] ?? query.value;
  const topicQuery = normalizeText(lastSegment);
  const topicExpressions = unique([
    ...(rule.topicKeywords ?? []),
    ...(rule.relatedEvidence ?? []),
    rule.title,
    rule.severity,
    ...(rule.category ? [rule.category] : []),
  ]);
  const topicMatches = findExpressions(topicQuery, topicExpressions);
  if (!topicMatches.length) return null;

  const specificity = Math.max(...topicMatches.map(expressionSpecificity));
  const relevance = Math.min(
    1,
    0.45 + topicMatches.length * 0.12 + Math.min(specificity, 5) * 0.05
  );
  const score = Math.round(Math.min(10, relevance * 7 + specificity * 0.35) * 10) / 10;

  return {
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    priority: rule.priority,
    score,
    factMatchQuality: 0,
    specificity,
    relevance,
    matchReasons: ['tema da regra identificado'],
    matchedTerms: topicMatches,
    guidance: rule.guidance,
    message: rule.message,
  };
}

/** Recupera regras por tema sem inferir que os fatos ocorreram na OS. */
export function retrieveInformationalRules(
  query: NormalizedText,
  rules: DataRule[]
): MatchedRule[] {
  return rules.flatMap((rule) => {
    const match = matchInformationalRule(query, rule);
    return match ? [match] : [];
  });
}

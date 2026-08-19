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
    severity: rule.severity ?? null,
    priority: rule.priority,
    score,
    factMatchQuality,
    specificity,
    relevance,
    matchReasons,
    matchedTerms,
    attentionLevel: rule.attentionLevel,
    guidance: rule.guidance,
    message: rule.message,
    missingInformation: rule.missingInformation,
  };
}

export function retrieveRules(
  query: NormalizedText,
  intent: QueryIntent,
  rules: DataRule[]
): MatchedRule[] {
  const directMatches = rules.flatMap((rule) => {
    const match = matchRule(query, intent, rule);
    return match ? [match] : [];
  });
  const sourceRulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const matchesById = new Map(directMatches.map((match) => [match.id, match]));

  // Segunda passagem: combina fatos que outras regras já confirmaram. Exemplo:
  // uma regra reconhece "antes", outra reconhece "durante" e a regra agregadora
  // decide o que acontece quando os dois grupos aparecem juntos.
  for (const aggregateRule of rules) {
    const policy = aggregateRule.matchPolicy?.minimumMatchedFactGroups;
    if (!policy) continue;

    const bestMatchByGroup = new Map<string, MatchedRule>();
    for (const match of directMatches) {
      if (match.id === aggregateRule.id) continue;
      const sourceRule = sourceRulesById.get(match.id);
      const group = sourceRule?.factGroup;
      if (!group || !policy.groups.includes(group) || !sourceRule?.severity) continue;
      const current = bestMatchByGroup.get(group);
      if (!current || match.score > current.score) bestMatchByGroup.set(group, match);
    }

    if (bestMatchByGroup.size < policy.count) continue;
    const supportingMatches = [...bestMatchByGroup.values()];
    const specificity = Math.max(1, bestMatchByGroup.size * 4);
    const factMatchQuality = Math.min(...supportingMatches.map((match) => match.factMatchQuality));
    const relevance = 1;
    const aggregateMatch: MatchedRule = {
      id: aggregateRule.id,
      title: aggregateRule.title,
      severity: aggregateRule.severity ?? null,
      priority: aggregateRule.priority,
      score: Math.round(Math.min(
        10,
        relevance * 6 + factMatchQuality * 2 + specificity * 0.4
      ) * 10) / 10,
      factMatchQuality,
      specificity,
      relevance,
      matchReasons: [
        `${bestMatchByGroup.size} grupos de fatos distintos foram confirmados por regras relacionadas`,
      ],
      matchedTerms: unique(supportingMatches.flatMap((match) => match.matchedTerms)),
      supportingRuleIds: supportingMatches.map((match) => match.id),
      attentionLevel: aggregateRule.attentionLevel,
      guidance: aggregateRule.guidance,
      message: aggregateRule.message,
      missingInformation: aggregateRule.missingInformation,
    };
    const directAggregate = matchesById.get(aggregateRule.id);
    // Se a mesma regra também casou pelo texto, preserva os melhores dados dos dois caminhos.
    matchesById.set(aggregateRule.id, directAggregate
      ? {
          ...aggregateMatch,
          score: Math.max(aggregateMatch.score, directAggregate.score),
          factMatchQuality: Math.max(
            aggregateMatch.factMatchQuality,
            directAggregate.factMatchQuality
          ),
          specificity: Math.max(aggregateMatch.specificity, directAggregate.specificity),
          relevance: Math.max(aggregateMatch.relevance, directAggregate.relevance),
          matchReasons: unique([...directAggregate.matchReasons, ...aggregateMatch.matchReasons]),
          matchedTerms: unique([...directAggregate.matchedTerms, ...aggregateMatch.matchedTerms]),
        }
      : aggregateMatch);
  }

  return [...matchesById.values()];
}

function matchInformationalRule(query: NormalizedText, rule: DataRule): MatchedRule | null {
  const lastSegment = query.segments[query.segments.length - 1] ?? query.value;
  const topicQuery = normalizeText(lastSegment);
  // Exceções também valem em consultas: um tema relacionado não pode sugerir
  // uma orientação que os próprios dados excluem para o cenário perguntado.
  if (findExpressions(query, rule.exceptions).length) {
    return null;
  }
  const topicExpressions = unique([
    ...(rule.topicKeywords ?? []),
    ...(rule.relatedEvidence ?? []),
    rule.title,
    ...(rule.severity ? [rule.severity] : []),
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
    severity: rule.severity ?? null,
    priority: rule.priority,
    score,
    factMatchQuality: 0,
    specificity,
    relevance,
    matchReasons: ['tema da regra identificado'],
    matchedTerms: topicMatches,
    attentionLevel: rule.attentionLevel,
    guidance: rule.guidance,
    message: rule.message,
    missingInformation: rule.missingInformation,
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

const RELATED_STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no',
  'nas', 'nos', 'um', 'uma', 'para', 'pra', 'por', 'que', 'qual', 'como', 'foi',
  'esta', 'esse', 'essa', 'isso', 'servico', 'regra', 'foto', 'fotos',
  'ficou', 'ficar', 'feito', 'fazer', 'fez', 'tem', 'tinha', 'deve', 'precisa',
  'necessario', 'necessaria', 'correto', 'correta', 'outro', 'outra',
]);

function conceptTokens(values: string[] | undefined): Set<string> {
  return new Set(
    normalizeText(values?.join(' ') ?? '').tokens.filter(
      (token) => token.length > 2 && !RELATED_STOP_WORDS.has(token)
    )
  );
}

interface CachedRuleConcepts {
  strongTokens: Set<string>;
  contextualTokens: Set<string>;
}

const RULE_CONCEPT_CACHE = new WeakMap<DataRule, CachedRuleConcepts>();

function getRuleConcepts(rule: DataRule): CachedRuleConcepts {
  const cached = RULE_CONCEPT_CACHE.get(rule);
  if (cached) return cached;
  const concepts = {
    strongTokens: conceptTokens([
      ...(rule.topicKeywords ?? []),
      ...(rule.relatedEvidence ?? []),
      ...(rule.conditionKeywords ?? []),
      ...(rule.equivalentExpressions ?? []),
    ]),
    contextualTokens: conceptTokens([
      rule.title,
      rule.description,
      rule.category ?? '',
      ...(rule.examples ?? []),
    ]),
  };
  RULE_CONCEPT_CACHE.set(rule, concepts);
  return concepts;
}

/**
 * Localiza regras conceitualmente próximas sem torná-las aplicáveis à decisão.
 * Esse segundo nível serve apenas para orientar o analista quando a frase não
 * comprovou todas as condições de uma regra.
 */
export function retrieveRelatedRules(
  query: NormalizedText,
  rules: DataRule[],
  limit = 5
): MatchedRule[] {
  const queryTokens = unique(
    query.tokens.filter((token) => token.length > 2 && !RELATED_STOP_WORDS.has(token))
  );
  if (!queryTokens.length) return [];

  return rules.flatMap((rule) => {
    if (findExpressions(query, rule.exceptions).length) {
      return [];
    }
    const { strongTokens, contextualTokens } = getRuleConcepts(rule);
    const matchedStrong = queryTokens.filter((token) => strongTokens.has(token));
    const matchedContextual = queryTokens.filter(
      (token) => !strongTokens.has(token) && contextualTokens.has(token)
    );
    const weightedMatch = matchedStrong.length * 3 + matchedContextual.length;
    if (matchedStrong.length < 2 || weightedMatch < 6) return [];

    const matchedTerms = unique([...matchedStrong, ...matchedContextual]);
    const specificity = matchedTerms.length;
    const relevance = Math.min(0.68, 0.3 + weightedMatch * 0.06);
    const score = Math.round((relevance * 6 + specificity * 0.25) * 10) / 10;
    return [{
      id: rule.id,
      title: rule.title,
      severity: rule.severity ?? null,
      priority: rule.priority,
      score,
      factMatchQuality: 0.25,
      specificity,
      relevance,
      matchReasons: ['conceitos relacionados identificados; ocorrência ainda não confirmada'],
      matchedTerms,
      attentionLevel: rule.attentionLevel,
      guidance: rule.guidance,
      message: rule.message,
      missingInformation: rule.missingInformation,
    } satisfies MatchedRule];
  })
    .sort((left, right) => right.score - left.score || left.priority - right.priority)
    .slice(0, Math.max(1, Math.floor(limit)));
}

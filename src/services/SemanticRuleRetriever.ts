import type { DataRule } from '../types';
import { normalizeText } from './TextNormalizer';
import { detectSemanticPolarity, type SemanticPolarity } from './SemanticPolarity';

// Quando existe alguma pista lexical, um catálogo curto reduz ruído e latência.
// Sem pista alguma, o catálogo completo continua disponível para o modelo.
const DEFAULT_CANDIDATE_LIMIT = 12;
const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no',
  'nas', 'nos', 'um', 'uma', 'para', 'pra', 'por', 'que', 'qual', 'como', 'foi',
  'esta', 'esse', 'essa', 'isso', 'servico', 'regra',
  'nao', 'sem', 'falta', 'faltou', 'faltam', 'faltaram', 'ausente',
]);

export interface SemanticRuleSelection {
  rules: DataRule[];
  strategy: 'ranked' | 'complete' | 'limited';
  totalRules: number;
  truncated: boolean;
}

function meaningfulTokens(text: string): Set<string> {
  const tokens = normalizeText(text).tokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token)
  );
  return new Set(tokens.flatMap((token) =>
    token.length >= 5 ? [token, `~${token.slice(0, 4)}`] : [token]
  ));
}

function overlapScore(queryTokens: Set<string>, values: string[] | undefined, weight: number): number {
  if (!values?.length) return 0;
  const valueTokens = meaningfulTokens(values.join(' '));
  let score = 0;
  for (const token of queryTokens) {
    if (valueTokens.has(token)) score += weight;
  }
  return score;
}

function scoreRule(
  queryTokens: Set<string>,
  queryPolarity: SemanticPolarity,
  rule: DataRule
): number {
  const lexicalScore = (
    overlapScore(queryTokens, [rule.title], 5) +
    overlapScore(queryTokens, [rule.description], 3) +
    overlapScore(queryTokens, rule.topicKeywords, 6) +
    overlapScore(queryTokens, rule.relatedEvidence, 6) +
    overlapScore(queryTokens, rule.conditionKeywords, 4) +
    overlapScore(queryTokens, rule.equivalentExpressions, 4) +
    overlapScore(queryTokens, rule.examples, 2) +
    overlapScore(queryTokens, rule.category ? [rule.category] : undefined, 1)
  );
  const rulePolarity = detectSemanticPolarity([
    rule.title,
    rule.description,
    ...rule.conditionKeywords,
    ...(rule.equivalentExpressions ?? []),
  ].join(' '));
  if (queryPolarity === 'absence') {
    return rulePolarity === 'absence' ? lexicalScore + 8 : Number.NEGATIVE_INFINITY;
  }
  return lexicalScore;
}

/**
 * Recuperação local prévia ao modelo. Reduz o catálogo enviado ao provider sem
 * transformar similaridade lexical em decisão de negócio.
 */
export function selectSemanticRuleCandidates(
  query: string,
  rules: DataRule[],
  limit = DEFAULT_CANDIDATE_LIMIT
): SemanticRuleSelection {
  const safeLimit = Math.max(1, Math.floor(limit));
  if (rules.length <= safeLimit) {
    return { rules, strategy: 'complete', totalRules: rules.length, truncated: false };
  }

  const queryTokens = meaningfulTokens(query);
  const queryPolarity = detectSemanticPolarity(query);
  const ranked = rules
    .map((rule) => ({ rule, score: scoreRule(queryTokens, queryPolarity, rule) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.rule.id.localeCompare(right.rule.id));

  if (!ranked.length) {
    return { rules, strategy: 'complete', totalRules: rules.length, truncated: false };
  }
  const selected = ranked.slice(0, safeLimit).map((candidate) => candidate.rule);
  return {
    rules: selected,
    strategy: ranked.length ? 'ranked' : 'limited',
    totalRules: rules.length,
    truncated: selected.length < rules.length,
  };
}

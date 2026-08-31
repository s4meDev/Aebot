import type { DataRule } from '../types';
import { normalizeText } from './TextNormalizer';

// O maior serviço atual tem menos de 50 regras. Manter o catálogo inteiro evita
// perder a regra certa justamente quando o analista usa um sinônimo imprevisível.
const DEFAULT_CANDIDATE_LIMIT = 64;
const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no',
  'nas', 'nos', 'um', 'uma', 'para', 'pra', 'por', 'que', 'qual', 'como', 'foi',
  'esta', 'esse', 'essa', 'isso', 'servico', 'regra',
]);

export interface SemanticRuleSelection {
  rules: DataRule[];
  strategy: 'ranked' | 'complete' | 'limited';
  totalRules: number;
  truncated: boolean;
}

function meaningfulTokens(text: string): Set<string> {
  return new Set(
    normalizeText(text).tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
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

function scoreRule(queryTokens: Set<string>, rule: DataRule): number {
  return (
    overlapScore(queryTokens, [rule.title], 5) +
    overlapScore(queryTokens, [rule.description], 3) +
    overlapScore(queryTokens, rule.topicKeywords, 6) +
    overlapScore(queryTokens, rule.relatedEvidence, 6) +
    overlapScore(queryTokens, rule.conditionKeywords, 4) +
    overlapScore(queryTokens, rule.equivalentExpressions, 4) +
    overlapScore(queryTokens, rule.examples, 2) +
    overlapScore(queryTokens, rule.category ? [rule.category] : undefined, 1)
  );
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
  const ranked = rules
    .map((rule) => ({ rule, score: scoreRule(queryTokens, rule) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.rule.id.localeCompare(right.rule.id));

  const selected = (ranked.length ? ranked : rules.map((rule) => ({ rule, score: 0 })))
    .slice(0, safeLimit)
    .map((candidate) => candidate.rule);
  return {
    rules: selected,
    strategy: ranked.length ? 'ranked' : 'limited',
    totalRules: rules.length,
    truncated: selected.length < rules.length,
  };
}

import type {
  DataRule,
  SemanticMappingStance,
  SemanticRuleMapping,
} from '../types';
import { normalizeText } from './TextNormalizer';

const ALLOWED_STANCES = new Set<SemanticMappingStance>([
  'asserted',
  'hypothetical',
  'informational',
  'negated_or_present',
]);
const MAX_MAPPINGS = 6;

export interface SemanticInterpretation {
  mappings: SemanticRuleMapping[];
  canonicalPrompt: string | null;
}

function cleanJson(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function allowedExpressions(rule: DataRule): Set<string> {
  return new Set([
    ...rule.conditionKeywords,
    ...(rule.equivalentExpressions ?? []),
  ]);
}

function resolveAllowedExpression(rule: DataRule, proposed: string): string | null {
  const allowed = [...allowedExpressions(rule)];
  if (allowed.includes(proposed)) return proposed;
  const normalizedProposed = normalizeText(proposed).value;
  return allowed.find(
    (expression) => normalizeText(expression).value === normalizedProposed
  ) ?? null;
}

interface TokenSpan {
  normalized: string;
  start: number;
  end: number;
}

function tokenSpans(text: string): TokenSpan[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].flatMap((match) => {
    const normalized = normalizeText(match[0]).tokens[0];
    const start = match.index;
    return normalized && start !== undefined
      ? [{ normalized, start, end: start + match[0].length }]
      : [];
  });
}

/** Reconcilia acentos/caixa sem aceitar uma citação que não exista na pergunta. */
function resolveLiteralQuote(originalQuery: string, proposedQuote: string): string | null {
  const exactIndex = originalQuery
    .toLocaleLowerCase('pt-BR')
    .indexOf(proposedQuote.toLocaleLowerCase('pt-BR'));
  if (exactIndex >= 0) {
    return originalQuery.slice(exactIndex, exactIndex + proposedQuote.length);
  }

  const originalTokens = tokenSpans(originalQuery);
  const proposedTokens = normalizeText(proposedQuote).tokens;
  if (proposedTokens.length < 2 || proposedTokens.length > originalTokens.length) return null;
  for (let start = 0; start <= originalTokens.length - proposedTokens.length; start += 1) {
    const matches = proposedTokens.every(
      (token, offset) => originalTokens[start + offset].normalized === token
    );
    if (matches) {
      return originalQuery.slice(
        originalTokens[start].start,
        originalTokens[start + proposedTokens.length - 1].end
      );
    }
  }
  return null;
}

function buildCanonicalPrompt(mappings: SemanticRuleMapping[]): string | null {
  if (!mappings.length || mappings.every((item) => item.stance === 'negated_or_present')) {
    return null;
  }

  const actionable = mappings.filter((item) => item.stance !== 'negated_or_present');
  const stances = new Set(actionable.map((item) => item.stance));
  if (stances.size !== 1) return null;

  const expressions = [...new Set(actionable.map((item) => item.canonicalExpression))];
  const statement = expressions.join(' e ');
  const [stance] = stances;
  if (stance === 'hypothetical') return `se ${statement}`;
  if (stance === 'informational') return `qual e a regra de ${statement}`;
  return statement;
}

/**
 * Aceita somente IDs, expressões cadastradas e citações realmente presentes
 * na pergunta. Qualquer saída livre ou inventada pelo modelo é descartada.
 */
export function parseSemanticInterpretation(
  text: string,
  originalQuery: string,
  serviceRules: DataRule[]
): SemanticInterpretation | null {
  try {
    const parsed = JSON.parse(cleanJson(text)) as Record<string, unknown>;
    if (!Array.isArray(parsed.mappings) || parsed.mappings.length > MAX_MAPPINGS) return null;
    if (parsed.mappings.length === 0) return { mappings: [], canonicalPrompt: null };

    const rulesById = new Map(serviceRules.map((rule) => [rule.id, rule]));
    const mappings: SemanticRuleMapping[] = [];

    for (const rawMapping of parsed.mappings) {
      if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) continue;
      const source = rawMapping as Record<string, unknown>;
      if (
        typeof source.ruleId !== 'string' ||
        typeof source.sourceQuote !== 'string' ||
        typeof source.canonicalExpression !== 'string' ||
        typeof source.stance !== 'string' ||
        !ALLOWED_STANCES.has(source.stance as SemanticMappingStance)
      ) {
        continue;
      }

      const rule = rulesById.get(source.ruleId);
      if (!rule) continue;
      const canonicalExpression = resolveAllowedExpression(rule, source.canonicalExpression);
      if (!canonicalExpression) continue;
      const proposedQuote = source.sourceQuote.trim();
      const quote = resolveLiteralQuote(originalQuery, proposedQuote);
      if (
        !quote ||
        normalizeText(quote).tokens.length < 2
      ) {
        continue;
      }

      mappings.push({
        ruleId: rule.id,
        sourceQuote: quote,
        canonicalExpression,
        stance: source.stance as SemanticMappingStance,
      });
    }

    const uniqueMappings = [...new Map(
      mappings.map((mapping) => [
        `${mapping.ruleId}:${mapping.canonicalExpression}:${mapping.stance}`,
        mapping,
      ])
    ).values()];
    if (!uniqueMappings.length) return null;

    const canonicalPrompt = buildCanonicalPrompt(uniqueMappings);
    const hasActionableMapping = uniqueMappings.some(
      (mapping) => mapping.stance !== 'negated_or_present'
    );
    if (hasActionableMapping && !canonicalPrompt) return null;

    return { mappings: uniqueMappings, canonicalPrompt };
  } catch {
    return null;
  }
}

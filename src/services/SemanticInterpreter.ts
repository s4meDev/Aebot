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
      if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) return null;
      const source = rawMapping as Record<string, unknown>;
      if (
        typeof source.ruleId !== 'string' ||
        typeof source.sourceQuote !== 'string' ||
        typeof source.canonicalExpression !== 'string' ||
        typeof source.stance !== 'string' ||
        !ALLOWED_STANCES.has(source.stance as SemanticMappingStance)
      ) {
        return null;
      }

      const rule = rulesById.get(source.ruleId);
      if (!rule || !allowedExpressions(rule).has(source.canonicalExpression)) return null;
      const quote = source.sourceQuote.trim();
      if (
        !quote ||
        normalizeText(quote).tokens.length < 2 ||
        !originalQuery.toLocaleLowerCase('pt-BR').includes(quote.toLocaleLowerCase('pt-BR'))
      ) {
        return null;
      }

      mappings.push({
        ruleId: rule.id,
        sourceQuote: quote,
        canonicalExpression: source.canonicalExpression,
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

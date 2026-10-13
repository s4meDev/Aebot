import type { DataRule, QueryIntent, RuleEvaluationResult, SemanticRuleMapping } from '../types';
import { retrieveRules } from './RuleRetriever';
import { findExpressions, normalizeText, type NormalizedText } from './TextNormalizer';
import { splitFactSources } from './FactSources';

// Palavras de ligação não são fatos. Equipe, frente e posição do adicional não entram aqui.
const CONNECTORS = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no',
  'nas', 'nos', 'um', 'uma', 'e', 'nem', 'tambem', 'apenas', 'so', 'que', 'para', 'pra', 'por', 'isso']);
// 0,75 é o cenário direto de intenção indefinida no recuperador. Não inclui
// correspondência apenas temática; o motor continua validando a conclusão.
const MINIMUM_FACT_QUALITY = 0.75;

export interface AnalysisCoverage {
  sources: string[];
  unresolvedSources: string[];
  confirmedMappings: SemanticRuleMapping[];
}

/** O atalho de esclarecimento aceita só o contexto cadastrado, não qualquer resposta curta. */
export function isKnownContextAnswer(prompt: string, applicableRules: DataRule[]): boolean {
  const text = normalizeText(prompt);
  const expressions = applicableRules.flatMap(rule => [...(rule.mandatoryConditions ?? []),
    ...(rule.mandatoryConditionGroups?.flatMap(group => group.expressions) ?? [])]);
  const contextTokens = new Set(normalizeText(findExpressions(text, expressions).join(' ')).tokens);
  return contextTokens.size > 0 && text.tokens.every(token => CONNECTORS.has(token) || contextTokens.has(token));
}

/** Uma regra encontrada não significa que todo o relato foi compreendido. */
export function inspectAnalysisCoverage(query: string, rules: DataRule[], intent: QueryIntent): AnalysisCoverage {
  const sources = splitFactSources(query);
  const atomicRules = rules.filter(rule => !rule.matchPolicy?.minimumMatchedFactGroups);
  const fullCatalog = new Map(rules.map(rule => [rule.id, rule]));
  const byId = new Map(atomicRules.map(rule => [rule.id, rule]));
  const confirmedMappings: SemanticRuleMapping[] = [];
  const unresolvedSources: string[] = [];
  // Contexto exigido pela própria regra também já foi entendido pelo motor.
  // Só contabilizo expressões que realmente aparecem, nunca o grupo inteiro.
  const coveredTokens = (text: NormalizedText, matches: ReturnType<typeof retrieveRules>) => new Set(matches.flatMap(match => {
    const rule = fullCatalog.get(match.id);
    const context = [...(rule?.mandatoryConditions ?? []),
      ...(rule?.mandatoryConditionGroups?.flatMap(group => group.expressions) ?? [])];
    return normalizeText([...match.matchedTerms, ...findExpressions(text, context)].join(' ')).tokens;
  }));
  // Listas como "sem documento A nem B" podem repetir o substantivo só uma vez.
  // Se o motor reconheceu todos os termos no relato completo, não peço IA para essa elipse.
  const whole = normalizeText(query);
  const wholeMatches = retrieveRules(whole, intent, rules).filter(rule => rule.factMatchQuality >= MINIMUM_FACT_QUALITY);
  const wholeTokens = coveredTokens(whole, wholeMatches);
  const fullyLexical = wholeMatches.length > 0 && whole.tokens.every(token => CONNECTORS.has(token) || wholeTokens.has(token));
  for (const source of sources) {
    const normalized = normalizeText(source);
    const matches = retrieveRules(normalized, intent, atomicRules).filter(rule => rule.factMatchQuality >= MINIMUM_FACT_QUALITY);
    const accountedTokens = coveredTokens(normalized, matches);
    // Uma palavra ou outra oração fora do cenário conhecido pede interpretação.
    // Isto é uma guarda de completude, não um classificador por palavras soltas.
    const residual = normalized.tokens.filter(token => !CONNECTORS.has(token) && !accountedTokens.has(token));
    if (!fullyLexical && (!matches.length || residual.length)) unresolvedSources.push(source);
    for (const match of matches) {
      if (match.severity === null) continue; // Orientação não vira fato classificatório confirmado.
      const rule = byId.get(match.id)!;
      const canonicalExpression = rule.conditionKeywords[0] ?? rule.equivalentExpressions?.[0];
      if (canonicalExpression) confirmedMappings.push({ ruleId: rule.id, sourceQuote: source, canonicalExpression,
        stance: intent === 'hipotese' ? 'hypothetical' : intent === 'pergunta_informativa' ? 'informational' : 'asserted' });
    }
  }
  return { sources, unresolvedSources, confirmedMappings };
}

/** Preservo os fatos conhecidos, mas não fecho uma OS que só entendi parcialmente. */
export function incompleteAnalysis(evaluation: RuleEvaluationResult): RuleEvaluationResult {
  return { ...evaluation, decision: null, hasSufficientEvidence: false, outcome: 'advisory',
    confidence: 'baixa', requiresHumanValidation: true, insufficiencyReason: 'missing_information',
    reasoningSummary: 'Reconheci parte do relato, mas ainda não consegui conferir o caso completo.',
    advisory: { summary: 'Reconheci parte do relato, mas ainda não consegui conferir o caso completo.',
      guidance: evaluation.primaryRule?.guidance ?? 'Confira os outros fatos antes de concluir a OS.',
      basisRuleIds: evaluation.matchedRules.map(rule => rule.id),
      missingInformation: ['Pode detalhar o outro ponto do caso?'] } };
}

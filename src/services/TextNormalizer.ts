import languageAliasesData from '../data/languageAliases.json';

export interface NormalizedText {
  original: string;
  value: string;
  tokens: string[];
  /** Trechos separados por fim de frase ou conectivos de contraste. */
  segments: string[];
}

const TYPO_DISTANCE_MIN_LENGTH = 6;
const EXPRESSION_CACHE_LIMIT = 4_096;
const EXPRESSION_TOKEN_CACHE = new Map<string, string[]>();
const PROTECTED_TOKENS = new Set(['nao', 'sem', 'com', 'antes', 'durante', 'depois']);
const FILLER_TOKENS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'um', 'uma',
  'em', 'na', 'no', 'nas', 'nos', 'para', 'pra', 'pela', 'pelo',
]);
interface LanguageAliasesSchema {
  version: string;
  aliases: Readonly<Record<string, string>>;
}

function parseLanguageAliases(value: unknown): LanguageAliasesSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Base de aliases linguísticos inválida: raiz deve ser objeto.');
  }

  const source = value as Record<string, unknown>;
  if (typeof source.version !== 'string' || !/^1\.\d+\.\d+$/.test(source.version)) {
    throw new Error('Base de aliases linguísticos inválida: versão não suportada.');
  }
  if (!source.aliases || typeof source.aliases !== 'object' || Array.isArray(source.aliases)) {
    throw new Error('Base de aliases linguísticos inválida: aliases deve ser objeto.');
  }

  const aliases = Object.fromEntries(
    Object.entries(source.aliases as Record<string, unknown>).map(([alias, canonical]) => {
      if (!alias.trim() || typeof canonical !== 'string' || !canonical.trim()) {
        throw new Error(`Base de aliases linguísticos inválida: alias "${alias}" inválido.`);
      }
      return [alias, canonical.trim()];
    })
  );

  return { version: source.version, aliases: Object.freeze(aliases) };
}

const LANGUAGE_ALIAS_STORE = parseLanguageAliases(languageAliasesData);
const LANGUAGE_ALIASES = LANGUAGE_ALIAS_STORE.aliases;
export const LANGUAGE_ALIASES_VERSION = LANGUAGE_ALIAS_STORE.version;

function normalizeValue(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => LANGUAGE_ALIASES[token] ?? token)
    .join(' ');
}

export function normalizeText(text: string): NormalizedText {
  const value = normalizeValue(text);
  const segments = text
    .split(/[.!?;\r\n]+|\b(?:mas|porém|porem|contudo|entretanto)\b/giu)
    .map(normalizeValue)
    .filter(Boolean);

  return {
    original: text,
    value,
    tokens: value ? value.split(' ') : [],
    segments: segments.length ? segments : value ? [value] : [],
  };
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith('s') && !PROTECTED_TOKENS.has(token)) {
    return token.slice(0, -1);
  }
  return token;
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left === right) return true;

  let differences = 0;
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return differences + (leftIndex < left.length || rightIndex < right.length ? 1 : 0) <= 1;
}

function tokensEquivalent(left: string, right: string): boolean {
  const normalizedLeft = singularize(left);
  const normalizedRight = singularize(right);
  if (normalizedLeft === normalizedRight) return true;
  const negatingPrefixes = ['i', 'in', 'im', 'des'];
  const isNegatedForm = negatingPrefixes.some(
    (prefix) =>
      normalizedLeft === `${prefix}${normalizedRight}` ||
      normalizedRight === `${prefix}${normalizedLeft}`
  );
  if (isNegatedForm) return false;
  if (
    normalizedLeft.length < TYPO_DISTANCE_MIN_LENGTH ||
    normalizedRight.length < TYPO_DISTANCE_MIN_LENGTH ||
    PROTECTED_TOKENS.has(normalizedLeft) ||
    PROTECTED_TOKENS.has(normalizedRight)
  ) {
    return false;
  }
  return editDistanceAtMostOne(normalizedLeft, normalizedRight);
}

interface ExpressionRange {
  start: number;
  end: number;
}

function normalizedExpressionTokens(expression: string): string[] {
  const cached = EXPRESSION_TOKEN_CACHE.get(expression);
  if (cached) return cached;
  const tokens = normalizeText(expression).tokens.filter(
    (token) => !FILLER_TOKENS.has(token)
  );
  EXPRESSION_TOKEN_CACHE.set(expression, tokens);
  if (EXPRESSION_TOKEN_CACHE.size > EXPRESSION_CACHE_LIMIT) {
    const oldest = EXPRESSION_TOKEN_CACHE.keys().next().value;
    if (typeof oldest === 'string') EXPRESSION_TOKEN_CACHE.delete(oldest);
  }
  return tokens;
}

function findExpressionRanges(text: NormalizedText, expression: string): ExpressionRange[] {
  // As expressões vêm da base e se repetem entre avaliações. O cache evita
  // renormalizar a mesma regra sem guardar o texto das perguntas.
  const expressionTokens = normalizedExpressionTokens(expression);
  const searchableTokens = text.tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => !FILLER_TOKENS.has(token));
  if (!expressionTokens.length || expressionTokens.length > searchableTokens.length) return [];

  const ranges: ExpressionRange[] = [];
  for (let start = 0; start <= searchableTokens.length - expressionTokens.length; start += 1) {
    const matches = expressionTokens.every((token, offset) =>
      tokensEquivalent(searchableTokens[start + offset].token, token)
    );
    if (matches) {
      ranges.push({
        start: searchableTokens[start].index,
        end: searchableTokens[start + expressionTokens.length - 1].index,
      });
    }
  }
  return ranges;
}

/** Faz correspondência por tokens inteiros e nunca por substring. */
export function findExpression(text: NormalizedText, expression: string): string | null {
  const [range] = findExpressionRanges(text, expression);
  return range ? text.tokens.slice(range.start, range.end + 1).join(' ') : null;
}

export function findExpressions(text: NormalizedText, expressions: string[] = []): string[] {
  return expressions.flatMap((expression) => (findExpression(text, expression) ? [expression] : []));
}

function rangeDistance(left: ExpressionRange, right: ExpressionRange): number {
  if (left.end < right.start) return right.start - left.end - 1;
  if (right.end < left.start) return left.start - right.end - 1;
  return 0;
}

function closestDistance(
  segment: NormalizedText,
  evidence: ExpressionRange,
  expressions: string[]
): number {
  const distances = expressions.flatMap((expression) =>
    findExpressionRanges(segment, expression).map((signal) => rangeDistance(signal, evidence))
  );
  return distances.length ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

/**
 * Relaciona sinal e evidência no mesmo trecho. Quando há sinais positivos e
 * negativos, vence o mais próximo da evidência; empate favorece a negação.
 */
export function hasScopedPositiveSignal(
  text: NormalizedText,
  evidenceExpressions: string[] = [],
  positiveSignals: string[] = [],
  negativeSignals: string[] = []
): boolean {
  if (!evidenceExpressions.length || !positiveSignals.length) return false;

  const evidenceOccurrences = text.segments.flatMap((segmentValue, segmentIndex) => {
    const segment = normalizeText(segmentValue);
    return evidenceExpressions.flatMap((expression) =>
      findExpressionRanges(segment, expression).map((evidence) => ({
        segment,
        segmentIndex,
        evidence,
      }))
    );
  });

  const latest = evidenceOccurrences.sort(
    (left, right) =>
      right.segmentIndex - left.segmentIndex || right.evidence.start - left.evidence.start
  )[0];
  if (!latest) return false;

  const positiveDistance = closestDistance(latest.segment, latest.evidence, positiveSignals);
  const negativeDistance = closestDistance(latest.segment, latest.evidence, negativeSignals);
  return Number.isFinite(positiveDistance) && positiveDistance < negativeDistance;
}

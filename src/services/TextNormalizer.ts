export interface NormalizedText {
  original: string;
  value: string;
  tokens: string[];
}

const TYPO_DISTANCE_MIN_LENGTH = 6;
const PROTECTED_TOKENS = new Set(['nao', 'sem', 'com', 'antes', 'durante', 'depois']);

export function normalizeText(text: string): NormalizedText {
  const value = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return {
    original: text,
    value,
    tokens: value ? value.split(' ') : [],
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

/** Faz correspondência por tokens inteiros e nunca por substring. */
export function findExpression(text: NormalizedText, expression: string): string | null {
  const expressionTokens = normalizeText(expression).tokens;
  if (!expressionTokens.length || expressionTokens.length > text.tokens.length) return null;

  for (let start = 0; start <= text.tokens.length - expressionTokens.length; start += 1) {
    const matches = expressionTokens.every((token, offset) =>
      tokensEquivalent(text.tokens[start + offset], token)
    );
    if (matches) return text.tokens.slice(start, start + expressionTokens.length).join(' ');
  }

  return null;
}

export function findExpressions(text: NormalizedText, expressions: string[] = []): string[] {
  return expressions.flatMap((expression) => (findExpression(text, expression) ? [expression] : []));
}

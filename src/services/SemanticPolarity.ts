import { normalizeText } from './TextNormalizer';

export type SemanticPolarity = 'absence' | 'present' | 'neutral';

const NEGATED_ABSENCE = [
  /\bnao falt(?:a|ou|aram)\b/,
  /\bnao (?:esta|ficou) sem\b/,
  /\bnao esta ausente\b/,
];

// Usa os mesmos verbos nas duas formas: reconhecer "não aparece" também
// exige reconhecer "aparece", para não aceitar uma falta inventada pelo modelo.
const EVIDENCE_VERBS = 'tem|teve|mostrou|mostraram|apresentou|apresentaram|aparece|apareceu|veio|registrou|registraram|mediu|mediram|aferiu|aferiram|comprovou|comprovaram|incluiu|lancou|colocou|fotografou|fotografaram';

const ABSENCE = [
  /\bsem\b/,
  /\bfalt(?:a|am|ou|aram|ando)\b/,
  /\bausencia\b/,
  /\bausent(?:e|es|ou|aram|ia)\b/,
  new RegExp(`\\bnao (?:${EVIDENCE_VERBS})\\b`),
  /\bnao foi (?:apresentad[ao]|registrad[ao]|medid[ao]|aferid[ao]|comprovad[ao])\b/,
  /\bninguem (?:registrou|mostrou|mediu|aferiu)\b/,
];

const PRESENCE = [
  new RegExp(`\\b(?:${EVIDENCE_VERBS})\\b`),
  /\bfoi (?:apresentad[ao]|registrad[ao]|medid[ao]|aferid[ao]|comprovad[ao])\b/,
];

/**
 * Detecta apenas a polaridade linguística geral do fato. Não interpreta a
 * regra de negócio; serve para impedir que "ausente" vire "formato errado".
 */
export function detectSemanticPolarity(text: string): SemanticPolarity {
  const normalized = normalizeText(text).value;
  if (!normalized) return 'neutral';
  if (NEGATED_ABSENCE.some((pattern) => pattern.test(normalized))) return 'present';
  if (ABSENCE.some((pattern) => pattern.test(normalized))) return 'absence';
  if (PRESENCE.some((pattern) => pattern.test(normalized))) return 'present';
  return 'neutral';
}

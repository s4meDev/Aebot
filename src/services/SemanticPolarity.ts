import { normalizeText } from './TextNormalizer';

export type SemanticPolarity = 'absence' | 'present' | 'neutral';

const NEGATED_ABSENCE = [
  // O normalizador transforma "faltando" em "falta" e "ausência" em
  // "ausente". A negação precisa reconhecer também essas formas canônicas.
  /\bnao (?:esta|estao|estava|estavam|ficou|ficaram) falt(?:a|ando)\b/,
  /\bnao (?:ha|houve|existe) (?:falta|ausencia|ausente)\b/,
  /\bnao falt(?:a|ou|aram)\b/,
  /\bnao (?:esta|ficou) sem\b/,
  /\bnao esta ausente\b/,
];

// Usa os mesmos verbos nas duas formas: reconhecer "não aparece" também
// exige reconhecer "aparece", para não aceitar uma falta inventada pelo modelo.
const EVIDENCE_VERBS = 'tem|teve|mostrou|mostraram|apresentou|apresentaram|aparece|apareceu|veio|registrou|registraram|mediu|mediram|aferiu|aferiram|comprovou|comprovaram|incluiu|lancou|colocou|fotografou|fotografaram|mandou|mandaram|enviou|enviaram|vejo|vemos|vi|vimos|enxergo|enxergamos|visualizo|visualizamos';
// Não conseguir ler ou identificar uma evidência relata uma limitação,
// não a negação do problema. A mesma construção positiva confirma acesso.
const PERCEPTION = '(?:ver|ler|identificar|visualizar|enxergar|comprovar|conferir|verificar|saber)';
const ABILITY = '(?:consigo|consegue|conseguimos|conseguem|consegui|conseguiram|da(?: para| pra)?)';

const ABSENCE = [
  /\bnem\b/,
  /\bnao ha\b/,
  /\bsem\b/,
  /\bfalt(?:a|am|ou|aram|ando)\b/,
  /\bausencia\b/,
  /\bausent(?:e|es|ou|aram|ia)\b/,
  /\bnao (?:existe|existem|houve|havia)\b/,
  new RegExp(`\\bnao (?:${EVIDENCE_VERBS})\\b`),
  /\bnao foi (?:apresentad[ao]|registrad[ao]|medid[ao]|aferid[ao]|comprovad[ao])\b/,
  /\bninguem (?:registrou|mostrou|mediu|aferiu)\b/,
  new RegExp(`\\bnao ${ABILITY} ${PERCEPTION}\\b`),
  new RegExp(`\\bninguem ${ABILITY} ${PERCEPTION}\\b`),
];

const PRESENCE = [
  new RegExp(`\\b(?:${EVIDENCE_VERBS})\\b`),
  /\bfoi (?:apresentad[ao]|registrad[ao]|medid[ao]|aferid[ao]|comprovad[ao])\b/,
  new RegExp(`\\b${ABILITY} ${PERCEPTION}\\b`),
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
  // "O documento é X" afirma a existência dele, não sua falta. Uso o
  // original para distinguir "é" de "e"; não trato conjunção como presença.
  // Uma negação antes do verbo não serve como prova positiva.
  const original = text.normalize('NFC');
  const copula = /(?:^|\s)é(?=\s|[.!?,;:]|$)/giu.exec(original);
  if (copula && !normalizeText(original.slice(0, copula.index)).tokens.slice(-1).includes('nao')) return 'present';
  return 'neutral';
}

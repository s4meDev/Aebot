import type { QueryIntent } from '../types';
import { findExpressions, type NormalizedText } from './TextNormalizer';

const HYPOTHETICAL_MARKERS = ['se faltar', 'se houver', 'caso falte', 'caso haja', 'e se'];
const QUESTION_MARKERS = ['como', 'qual', 'quando', 'onde', 'por que', 'porque'];
const FACT_MARKERS = [
  'faltou',
  'faltaram',
  'esta ausente',
  'está ausente',
  'nao foi apresentada',
  'não foi apresentada',
  'nao apresentou',
  'não apresentou',
  'sem',
  'foi executado',
  'foi corrigido',
  'esta ilegivel',
  'está ilegível',
];

export function classifyQueryIntent(query: NormalizedText): QueryIntent {
  if (!query.value) return 'indefinida';
  if (findExpressions(query, HYPOTHETICAL_MARKERS).length) return 'hipotese';

  const startsAsQuestion = QUESTION_MARKERS.some(
    (marker) => query.value === normalizeMarker(marker) || query.value.startsWith(`${normalizeMarker(marker)} `)
  );
  if (startsAsQuestion) return 'pergunta_informativa';
  if (findExpressions(query, FACT_MARKERS).length) return 'relato_afirmativo';
  if (query.original.includes('?')) return 'pergunta_informativa';
  return 'indefinida';
}

function normalizeMarker(marker: string): string {
  return marker.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

import type { QueryIntent } from '../types';
import { findExpressions, type NormalizedText } from './TextNormalizer';

const HYPOTHETICAL_MARKERS = [
  'se faltar',
  'se houver',
  'se nao',
  'se tiver',
  'se estiver',
  'caso falte',
  'caso haja',
  'caso nao',
  'e se',
];
const QUESTION_MARKERS = [
  'como',
  'qual',
  'quando',
  'onde',
  'por que',
  'porque',
  'o que',
  'quero entender',
  'me explique',
  'me explica',
  'me diga',
  'liste',
  'mostre',
  'quais',
  'que regra',
  'para que',
];
const FACT_MARKERS = [
  'ausente',
  'falta',
  'faltam',
  'faltou',
  'faltaram',
  'esta ausente',
  'está ausente',
  'nao foi apresentada',
  'não foi apresentada',
  'nao apresentou',
  'não apresentou',
  'nao comprovou',
  'não comprovou',
  'nao registrou',
  'nao lancou',
  'nao lancaram',
  'nao incluiu',
  'nao incluiram',
  'nao colocou',
  'nao colocaram',
  'nao conseguiu',
  'nao consegue',
  'nao consigo',
  'nao tem opcao',
  'nao ha possibilidade',
  'nao existe possibilidade',
  'não registrou',
  'nao apareceu',
  'não apareceu',
  'ninguem registrou',
  'ninguém registrou',
  'nao tem',
  'não tem',
  'nao veio',
  'não veio',
  'nao botaram',
  'não botaram',
  'esqueceram',
  'esqueceu',
  'sem',
  'foi executado',
  'foi corrigido',
  'esta ilegivel',
  'está ilegível',
  'fora do padrao',
  'fora do padrão',
  'nao aceito',
  'não aceito',
  'formato invalido',
  'formato inválido',
];

const CASE_ACTION_MARKERS = [
  'entao tiro',
  'entao retiro',
  'entao removo',
  'tiro',
  'retiro',
  'removo',
  'devo tirar',
  'devo retirar',
  'devo remover',
  'posso tirar',
  'posso retirar',
  'posso remover',
  'o que faco',
  'como corrijo',
];

function hasFactBeforeActionQuestion(query: NormalizedText): boolean {
  return CASE_ACTION_MARKERS.some((marker) => {
    const markerTokens = normalizeMarker(marker).split(' ');
    const markerIndex = query.tokens.findIndex((_, start) =>
      markerTokens.every((token, offset) => query.tokens[start + offset] === token)
    );
    if (markerIndex <= 0) return false;
    const prefixTokens = query.tokens.slice(0, markerIndex);
    const prefix = prefixTokens.join(' ');
    return findExpressions({
      original: prefix,
      value: prefix,
      tokens: prefixTokens,
      segments: [prefix],
    }, FACT_MARKERS).length > 0;
  });
}

export function classifyQueryIntent(query: NormalizedText): QueryIntent {
  if (!query.value) return 'indefinida';
  const hasConditionalFact =
    query.tokens.includes('se') && findExpressions(query, FACT_MARKERS).length > 0;
  if (findExpressions(query, HYPOTHETICAL_MARKERS).length || hasConditionalFact) return 'hipotese';

  const startsAsQuestion = QUESTION_MARKERS.some(
    (marker) =>
      query.value === normalizeMarker(marker) ||
      query.value.startsWith(`${normalizeMarker(marker)} `)
  );
  if (startsAsQuestion) return 'pergunta_informativa';
  // Uma pergunta curta pode conter "sem" ou "falta" apenas para consultar
  // o enquadramento. Em contexto acumulado, porém, um fato afirmado numa
  // frase anterior continua sendo fato mesmo quando a continuação é curta.
  if (query.original.includes('?')) {
    // "Sem foto da vala na OS, então tiro o desdobro?" contém uma dúvida,
    // mas começa relatando um fato real. A ação perguntada não apaga esse fato.
    if (hasFactBeforeActionQuestion(query)) return 'relato_afirmativo';
    const earlierSegments = query.segments.slice(0, -1);
    const hasEarlierFact = earlierSegments.some(
      (segment) => findExpressions({
        original: segment,
        value: segment,
        tokens: segment.split(' '),
        segments: [segment],
      }, FACT_MARKERS).length > 0
    );
    return hasEarlierFact ? 'relato_afirmativo' : 'pergunta_informativa';
  }
  if (findExpressions(query, FACT_MARKERS).length) return 'relato_afirmativo';
  return 'indefinida';
}

const SERVICE_OVERVIEW_MARKERS = [
  'como funciona esse servico',
  'como funciona o servico',
  'como se analisa esse servico',
  'como analisar esse servico',
  'quero entender o servico',
  'me explique o servico',
  'me explica o servico',
  'quais sao as regras do servico',
  'quais regras do servico',
  'quais sao as regras',
  'quais regras tem',
  'me fale das regras',
  'resuma o servico',
  'o que analisar nesse servico',
  'o que devo analisar',
  'o que preciso analisar',
];

export function isServiceOverviewQuestion(query: NormalizedText): boolean {
  return findExpressions(query, SERVICE_OVERVIEW_MARKERS).length > 0;
}

function normalizeMarker(marker: string): string {
  return marker.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

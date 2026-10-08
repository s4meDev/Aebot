import { describe, expect, it } from 'vitest';
import { classifyQueryIntent } from '../QueryIntentClassifier';
import { normalizeText } from '../TextNormalizer';

describe('intenção da pergunta, sem regra de negócio', () => {
  it.each([
    'Não enviaram nenhuma imagem de como ficou depois que terminaram.',
    'Conferi no sistema e identifiquei que já tinha sido feito.',
    'Ninguém consegue saber a medida real.',
    'Não se consegue ver a medição.',
  ])('mantém observação afirmativa: %s', (query) => {
    expect(classifyQueryIntent(normalizeText(query))).toBe('relato_afirmativo');
  });
  it.each(['Se faltar a imagem, como fica?', 'Se não se consegue ver a medição, reprova?'])('mantém hipótese: %s', (query) => {
    expect(classifyQueryIntent(normalizeText(query))).toBe('hipotese');
  });
  it.each(['Qual regra se aplica à foto?', 'Como conferir a medição?', 'Conferi a foto, qual é a regra?'])('mantém consulta: %s', (query) => {
    expect(classifyQueryIntent(normalizeText(query))).toBe('pergunta_informativa');
  });
});

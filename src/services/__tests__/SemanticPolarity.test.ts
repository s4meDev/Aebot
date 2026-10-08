import { describe, expect, it } from 'vitest';
import { detectSemanticPolarity } from '../SemanticPolarity';

describe('polaridade das evidências', () => {
  it.each(['O documento é de outro tipo.', 'A origem É a solicitação informada.', 'O registro e\u0301 válido.'])('afirma existência sem confundir conjunção: %s', text => {
    expect(detectSemanticPolarity(text)).toBe('present');
  });
  it('não usa uma cópula negada ou a conjunção e como prova positiva', () => {
    expect(detectSemanticPolarity('O documento não é válido.')).toBe('neutral');
    expect(detectSemanticPolarity('O documento na\u0303o e\u0301 válido.')).toBe('neutral');
    expect(detectSemanticPolarity('Documento e formulário.')).toBe('neutral');
    expect(detectSemanticPolarity('O registro é ausente.')).toBe('absence');
  });
  it.each(['Nem da execução.', 'Não há evidência.', 'Nem durante o trabalho.'])('preserva a negação no trecho coordenado: %s', phrase => {
    expect(detectSemanticPolarity(phrase)).toBe('absence');
  });
  it.each(['Não está faltando registro do resultado.', 'Não estavam faltando evidências.',
    'Não há falta de comprovação.', 'Não houve ausência de registro.'])('dupla negação não vira falta: %s', phrase => {
    expect(detectSemanticPolarity(phrase)).toBe('present');
  });
  it.each(['dá pra ler', 'dá para identificar', 'consigo ver', 'conseguimos visualizar'])
    ('distingue capacidade de incapacidade de conferir evidência: %s', (phrase) => {
      expect(detectSemanticPolarity(`Não ${phrase} a identificação.`)).toBe('absence');
      expect(detectSemanticPolarity(`${phrase} a identificação.`)).toBe('present');
    });
  it.each(['aparece', 'apareceu', 'veio', 'fotografaram', 'registraram', 'mediram', 'comprovaram'])
    ('reconhece a presença e a ausência usando o mesmo verbo: %s', (verb) => {
      expect(detectSemanticPolarity(`A evidência ${verb} na OS.`)).toBe('present');
      expect(detectSemanticPolarity(`A evidência não ${verb} na OS.`)).toBe('absence');
    });
  it('preserva ausência apesar de haver um verbo positivo no relato', () => {
    expect(detectSemanticPolarity('Apresentou a foto sem a medição.')).toBe('absence');
    expect(detectSemanticPolarity('A foto não faltou.')).toBe('present');
    expect(detectSemanticPolarity('Evidência da OS.')).toBe('neutral');
  });
});

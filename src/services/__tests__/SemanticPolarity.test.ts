import { describe, expect, it } from 'vitest';
import { detectSemanticPolarity } from '../SemanticPolarity';

describe('polaridade das evidências', () => {
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

import { describe, expect, it } from 'vitest';
import { splitLocalSources } from '../LocalSources';

describe('citações locais de fatos coordenados', () => {
  it('mantém as citações literais e a negação de cada item', () => {
    const query = 'Não há documento inicial nem da revisão nem do encerramento. O recibo está presente.';
    const parts = splitLocalSources(query);
    expect(parts).toEqual(['Não há documento inicial', 'nem da revisão', 'nem do encerramento.', 'O recibo está presente.']);
    for (const part of parts) expect(query).toContain(part);
  });
  it.each(['Não está faltando documento nem recibo.', 'O documento está presente e o recibo também.',
    'Não mostrou documento nem sempre é possível fotografar.', 'Não mostrou documento nem por isso é fraude.',
    'O nematódeo aparece na imagem.', 'SEM documento NEM recibo.'])('não inventa contexto em %s', query => {
    const parts = splitLocalSources(query);
    expect(parts.length).toBe(query.startsWith('SEM') ? 2 : 1);
    for (const part of parts) expect(query).toContain(part);
  });
  it('mantém a condição hipotética no relato original, sem trocar as palavras', () => {
    expect(splitLocalSources('Se não houver documento nem recibo, como proceder?'))
      .toEqual(['Se não houver documento', 'nem recibo, como proceder?']);
  });
});

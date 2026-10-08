import { describe, expect, it } from 'vitest';
import { validatePublicPrefill, validatePublicSnapshot } from '../PublicCatalogPreparation';

const prefill = { content: '', truncated: false, generation_settings: { n_predict: 0 },
  tokens_evaluated: 100, tokens_predicted: 1, tokens: [123], stop_type: 'eos' };

describe('preparação sem resposta ou tokens gerados no arquivo', () => {
  it('aceita somente encerramento vazio e snapshot com todos os tokens de entrada', () => {
    expect(() => validatePublicPrefill(prefill, 100)).not.toThrow();
    expect(() => validatePublicSnapshot({ n_saved: 100, n_written: 1000 }, 100)).not.toThrow();
  });
  it('aceita runtime que realmente não amostra nenhum token', () => {
    expect(() => validatePublicPrefill({ ...prefill, tokens_predicted: 0, tokens: [], stop_type: 'limit' }, 100)).not.toThrow();
  });
  it.each([{ content: 'resposta' }, { truncated: true }, { generation_settings: { n_predict: 1 } },
    { tokens_evaluated: 99 }, { tokens_predicted: 2, tokens: [1, 2] }, { tokens_predicted: '0' },
    { tokens: [] }, { stop_type: 'limit' }])('recusa geração ou metadados divergentes: %j', change => {
    expect(() => validatePublicPrefill({ ...prefill, ...change }, 100)).toThrow();
  });
  it.each([{ n_saved: 101, n_written: 1000 }, { n_saved: 99, n_written: 1000 },
    { n_saved: 100, n_written: 0 }, { n_saved: 100, n_written: 0.5 }])('recusa snapshot incompleto ou com token extra: %j', result => {
    expect(() => validatePublicSnapshot(result, 100)).toThrow();
  });
});

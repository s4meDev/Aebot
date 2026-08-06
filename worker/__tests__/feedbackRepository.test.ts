import { describe, expect, it } from 'vitest';
import { listFeedback, saveFeedback } from '../feedbackRepository';
import { createFakeD1 } from './fakeD1';

describe('feedbackRepository', () => {
  it('salva somente os campos previstos e recupera o mais recente primeiro', async () => {
    const fake = createFakeD1();
    await saveFeedback(fake.database, {
      id: 'feedback-1',
      analystId: 'analista01',
      serviceId: 'servico-a',
      category: 'sugestao',
      message: 'Seria útil melhorar esta explicação.',
      appVersion: '2.5.0',
      createdAt: '2026-08-06T10:00:00.000Z',
    });
    await saveFeedback(fake.database, {
      id: 'feedback-2',
      analystId: 'analista02',
      serviceId: 'servico-a',
      category: 'interface',
      message: 'O botão ficou difícil de localizar.',
      appVersion: '2.5.0',
      createdAt: '2026-08-06T11:00:00.000Z',
    });

    await expect(listFeedback(fake.database, { limit: 100 })).resolves.toEqual([
      expect.objectContaining({ id: 'feedback-2', analystId: 'analista02' }),
      expect.objectContaining({ id: 'feedback-1', analystId: 'analista01' }),
    ]);
    await expect(listFeedback(fake.database, { category: 'sugestao', limit: 100 }))
      .resolves.toEqual([expect.objectContaining({ id: 'feedback-1' })]);
    await expect(listFeedback(fake.database, { limit: 1, offset: 1 }))
      .resolves.toEqual([expect.objectContaining({ id: 'feedback-1' })]);
  });
});

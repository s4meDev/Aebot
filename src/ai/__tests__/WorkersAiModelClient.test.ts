import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKERS_AI_MODEL,
  WorkersAiModelClient,
  type WorkersAiBinding,
} from '../WorkersAiModelClient';

describe('WorkersAiModelClient', () => {
  it('usa um modelo online de raciocínio como contingência padrão', () => {
    expect(DEFAULT_WORKERS_AI_MODEL).toBe('@cf/openai/gpt-oss-20b');
  });

  it('converte o contrato estruturado para mensagens do Workers AI', async () => {
    const run = vi.fn().mockResolvedValue({ response: '{"mappings":[]}' });
    const client = new WorkersAiModelClient({ run } as WorkersAiBinding);
    const result = await client.request(
      [{ role: 'user', parts: [{ text: 'sem foto fazendo' }] }],
      'Use apenas o catálogo.',
      1_024
    );

    expect(result).toEqual({
      status: 'ok',
      provider: 'workers-ai',
      text: '{"mappings":[]}',
    });
    expect(run).toHaveBeenCalledWith(DEFAULT_WORKERS_AI_MODEL, expect.objectContaining({
      temperature: 0,
      max_tokens: 1_024,
      messages: [
        { role: 'system', content: 'Use apenas o catálogo.' },
        { role: 'user', content: 'sem foto fazendo' },
      ],
    }));
  });

  it('distingue limite de cota de erro técnico', async () => {
    const limited = new WorkersAiModelClient({
      run: vi.fn().mockRejectedValue({ status: 429 }),
    });
    const failed = new WorkersAiModelClient({
      run: vi.fn().mockRejectedValue(new Error('indisponível')),
    });

    await expect(limited.request([], '', 10)).resolves.toMatchObject({ status: 'rate_limited' });
    await expect(failed.request([], '', 10)).resolves.toMatchObject({ status: 'api_error' });
  });

  it('rejeita nomes de modelo fora do namespace Cloudflare', () => {
    expect(() => new WorkersAiModelClient({ run: vi.fn() }, 'modelo-local')).toThrow(
      'Modelo do Workers AI inválido.'
    );
  });
});

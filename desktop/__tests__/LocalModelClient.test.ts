import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalModelClient } from '../LocalModelClient';

afterEach(() => vi.unstubAllGlobals());
describe('Qwen local', () => {
  it('não tenta nuvem quando o runtime está indisponível', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await new LocalModelClient(() => null).request([], '', 32)).status).toBe('api_error');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('recusa endpoint externo', async () => {
    const client = new LocalModelClient(() => ({ url: 'https://externo.example', token: 'x' }));
    await expect(client.request([], '', 32)).rejects.toThrow('127.0.0.1');
  });
  it('envia JSON restrito ao loopback e devolve só metadados de uso', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: '{"mappings":[]}' }, finish_reason: 'stop',
    }], usage: { prompt_tokens: 123, completion_tokens: 12 } })));
    vi.stubGlobal('fetch', fetch);
    const client = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'privado' }));
    const result = await client.request([{ role: 'user', parts: [{ text: 'minha pergunta' }] }], 'instrução', 500,
      { responseSchema: { type: 'object' }, validateText: (text) => text.includes('mappings') });
    expect(result.status).toBe('ok');
    expect(result.attempts?.[0]).toMatchObject({ inputTokens: 123, outputTokens: 12, provider: 'local' });
    expect(JSON.stringify(result.attempts)).not.toContain('minha pergunta');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.response_format.schema).toEqual({ type: 'object' });
    expect(body.chat_template_kwargs.enable_thinking).toBe(false);
    expect(body).toMatchObject({ temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, seed: 42 });
  });
  it.each(['length', 'stop'])('recusa saída truncada ou fora do contrato (%s)', async (finish_reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: '{"decision":"Conforme"}' }, finish_reason,
    }] }))));
    const result = await new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'x' }))
      .request([], '', 32, { validateText: () => false });
    expect(result.status).toBe('api_error'); expect(result.text).toBeUndefined();
  });
});

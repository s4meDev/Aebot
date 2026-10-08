import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalModelClient } from '../LocalModelClient';

afterEach(() => vi.unstubAllGlobals());
describe('Qwen local', () => {
  it.each([-1, 1.1, NaN, Infinity])('recusa temperatura experimental inválida: %s', temperature => {
    expect(() => new LocalModelClient(() => null, { temperature })).toThrow('Temperatura experimental inválida');
  });
  it('distingue o experimento determinístico sem alterar a temperatura padrão', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"m":[]}' } }] })));
    vi.stubGlobal('fetch', fetcher);
    const client = new LocalModelClient(() => ({ url: 'http://127.0.0.1:1234', token: 'sintetico' }), { temperature: 0 });
    await client.request([], 'Catálogo público.', 32);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).temperature).toBe(0);
    expect(client.cacheKey).not.toBe(new LocalModelClient(() => null).cacheKey);
  });
  it('prepara somente o sistema público antes da inferência, nunca entrega histórico ao cache', async () => {
    const prepareSystemPrefix = vi.fn().mockResolvedValue(false);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"m":[]}' } }] })));
    vi.stubGlobal('fetch', fetcher);
    const client = new LocalModelClient(() => ({ url: 'http://127.0.0.1:1234', token: 'a' }), { prepareSystemPrefix });
    const result = await client.request([{ role: 'user', parts: [{ text: 'RELATO PRIVADO' }] }], 'catálogo público', 64);
    expect(result.status).toBe('ok');
    expect(prepareSystemPrefix).toHaveBeenCalledWith('catálogo público\n/no_think');
    expect(JSON.stringify(prepareSystemPrefix.mock.calls)).not.toContain('PRIVADO');
    expect(prepareSystemPrefix.mock.invocationCallOrder[0]).toBeLessThan(fetcher.mock.invocationCallOrder[0]);
  });
  it('exporta somente tempos e contagens válidos do runtime', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: '{"m":[]}' }, finish_reason: 'stop',
    }], timings: { cache_n: 100, prompt_n: 12, prompt_ms: 3.5, predicted_n: -1, predicted_ms: 'inválido',
      prompt: 'RELATO_PRIVADO', reasoning_content: 'RACIOCINIO_PRIVADO' } }))));
    const onTimings = vi.fn();
    const client = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'x' }), { onTimings, indexed: true });
    await client.request([], '', 32);
    expect(onTimings).toHaveBeenCalledWith({ cachedTokens: 100, processedTokens: 12, promptMs: 3.5,
      generatedTokens: undefined, generationMs: undefined });
    expect(JSON.stringify(onTimings.mock.calls)).not.toContain('PRIVADO');
    expect(client.localInterpretationProtocol).toBe('indexed');
  });
  it('separa identidade, cache e métricas de um candidato sem mudar o padrão', () => {
    const standard = new LocalModelClient(() => null);
    const candidate = new LocalModelClient(() => null, { modelName: 'Modelo-sintetico', modelSha256: 'a'.repeat(64) });
    expect(candidate.cacheKey).not.toBe(standard.cacheKey);
    expect(candidate.modelChain).toEqual(['Modelo-sintetico']);
    expect(candidate.cacheKey).toContain('a'.repeat(64));
  });
  it('separa o cache do experimento com orçamento menor, sem mudar o padrão direto', () => {
    const defaultClient = new LocalModelClient(() => null);
    const limited = new LocalModelClient(() => null, { thinking: true, reasoningBudget: 128 });
    expect(defaultClient.cacheKey).toContain(':direct');
    expect(limited.cacheKey).toContain(':thinking-128');
  });
  it('preserva consumo reportado quando o texto não é JSON válido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: '{resposta inválida' }, finish_reason: 'stop',
    }], usage: { prompt_tokens: 120, completion_tokens: 20 } }))));
    const result = await new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'x' }))
      .request([], '', 32);
    expect(result.text).toBeUndefined();
    expect(result.attempts?.[0]).toMatchObject({ status: 'invalid_response', inputTokens: 120, outputTokens: 20 });
  });
  it('mantém o raciocínio separado do texto e usa o perfil correspondente', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: '{"mappings":[]}', reasoning_content: 'raciocínio não exportável' }, finish_reason: 'stop',
    }] })));
    vi.stubGlobal('fetch', fetch);
    const client = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'x' }), { thinking: true });
    const result = await client.request([], 'instrução', 1536);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ temperature: 0.6, top_p: 0.95, chat_template_kwargs: { enable_thinking: true } });
    expect(JSON.stringify(result)).not.toContain('não exportável');
    expect(client.cacheKey).toContain('thinking-512');
  });
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
    expect(result.attempts?.[0].status).toBe('invalid_response');
  });
});

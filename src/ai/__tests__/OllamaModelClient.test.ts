import { afterEach, describe, expect, it, vi } from 'vitest';
import { ruleEngine } from '../../services/RuleEngine';
import { GeminiProvider } from '../GeminiProvider';
import {
  normalizeOllamaBaseUrl,
  normalizeOllamaModel,
  OllamaModelClient,
} from '../OllamaModelClient';
import type { StructuredModelClient } from '../StructuredModelClient';

afterEach(() => vi.unstubAllGlobals());

describe('OllamaModelClient', () => {
  it('aceita somente um servidor Ollama local e um nome de modelo seguro', () => {
    expect(normalizeOllamaBaseUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(normalizeOllamaBaseUrl('http://localhost:11434')).toBe('http://localhost:11434');
    expect(normalizeOllamaBaseUrl('https://ollama.example')).toBeNull();
    expect(normalizeOllamaBaseUrl('http://192.168.0.10:11434')).toBeNull();
    expect(normalizeOllamaModel('qwen3:4b')).toBe('qwen3:4b');
    expect(normalizeOllamaModel('../modelo')).toBeNull();
  });

  it('solicita JSON sem streaming e sem raciocínio exposto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: { role: 'assistant', content: '{"mappings":[]}' },
      done: true,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new OllamaModelClient('http://localhost:11434', 'qwen3:4b');
    const result = await client.request(
      [{ role: 'user', parts: [{ text: 'pergunta' }] }],
      'instrução de sistema',
      512
    );

    expect(result).toEqual({
      status: 'ok',
      provider: 'ollama',
      text: '{"mappings":[]}',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: 'qwen3:4b', stream: false, think: false, format: 'json' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'instrução de sistema' });
  });

  it('usa a IA local somente para mapear linguagem e preserva a decisão do motor', async () => {
    const prompt = 'não apareceu o momento do torque';
    const modelClient: StructuredModelClient = {
      provider: 'ollama',
      cacheKey: 'ollama:test',
      request: vi.fn().mockResolvedValue({
        status: 'ok',
        provider: 'ollama',
        text: JSON.stringify({
          mappings: [{
            ruleId: 'RULE-RC-07',
            sourceQuote: prompt,
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
        }),
      }),
    };
    const provider = new GeminiProvider(ruleEngine, {
      getModelClient: () => modelClient,
      humanizeDeterministicResponses: false,
    });

    const result = await provider.generateResponse(
      '',
      prompt,
      { id: 'reparo-cavalete', name: 'Reparo de Cavalete' }
    );

    expect(result.provider).toBe('ollama');
    expect(result.decision).toBe('Não Conforme');
    expect(result.evaluation.primaryRule?.id).toBe('RULE-RC-07');
  });

  it('compartilha uma interpretação simultânea idêntica entre vários analistas', async () => {
    const prompt = 'não apareceu o momento do torque';
    const request = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      return {
        status: 'ok',
        provider: 'ollama',
        text: JSON.stringify({
          mappings: [{
            ruleId: 'RULE-RC-07',
            sourceQuote: prompt,
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
        }),
      };
    });
    const modelClient: StructuredModelClient = {
      provider: 'ollama',
      cacheKey: 'ollama:concorrencia',
      request,
    };
    const provider = new GeminiProvider(ruleEngine, {
      getModelClient: () => modelClient,
      humanizeDeterministicResponses: false,
    });

    const [first, second] = await Promise.all([
      provider.generateResponse('', prompt, { id: 'reparo-cavalete', name: 'Reparo de Cavalete' }),
      provider.generateResponse('', prompt, { id: 'reparo-cavalete', name: 'Reparo de Cavalete' }),
    ]);

    expect(request).toHaveBeenCalledOnce();
    expect(first.decision).toBe('Não Conforme');
    expect(second.decision).toBe('Não Conforme');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  FallbackStructuredModelClient,
  type StructuredModelClient,
  type StructuredModelResult,
} from '../StructuredModelClient';

function client(
  provider: 'gemini' | 'workers-ai',
  result: StructuredModelResult
): StructuredModelClient {
  return {
    provider,
    providerChain: [provider],
    cacheKey: provider,
    request: vi.fn().mockResolvedValue(result),
  };
}

describe('FallbackStructuredModelClient', () => {
  it('usa a contingência quando o primeiro modelo responde fora do contrato', async () => {
    const primary = client('gemini', {
      status: 'ok',
      provider: 'gemini',
      text: '{"resposta":"fora do contrato"}',
    });
    const fallback = client('workers-ai', {
      status: 'ok',
      provider: 'workers-ai',
      text: '{"mappings":[]}',
    });
    const chain = new FallbackStructuredModelClient(primary, fallback);

    const result = await chain.request([], 'instrução', 256, {
      validateText: (text) => text.includes('"mappings"'),
    });

    expect(result.provider).toBe('workers-ai');
    expect(fallback.request).toHaveBeenCalledOnce();
  });

  it('preserva a resposta primária quando ela atende ao contrato', async () => {
    const primary = client('gemini', {
      status: 'ok',
      provider: 'gemini',
      text: '{"mappings":[]}',
    });
    const fallback = client('workers-ai', {
      status: 'ok',
      provider: 'workers-ai',
      text: '{"mappings":[]}',
    });
    const chain = new FallbackStructuredModelClient(primary, fallback);

    const result = await chain.request([], 'instrução', 256, {
      validateText: (text) => text.includes('"mappings"'),
    });

    expect(result.provider).toBe('gemini');
    expect(fallback.request).not.toHaveBeenCalled();
  });
});

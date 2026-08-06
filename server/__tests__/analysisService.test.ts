import { afterEach, describe, expect, it, vi } from 'vitest';
import { AebotAnalysisService } from '../analysisService';
import { loadServerConfig } from '../config';

afterEach(() => vi.unstubAllGlobals());

describe('AebotAnalysisService providers', () => {
  it('liga o Ollama local ao mesmo motor determinístico do backend', async () => {
    const prompt = 'não apareceu o momento do torque';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: {
        role: 'assistant',
        content: JSON.stringify({
          mappings: [{
            ruleId: 'RULE-RC-07',
            sourceQuote: prompt,
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
        }),
      },
      done: true,
    }), { status: 200 })));
    const service = new AebotAnalysisService(loadServerConfig({
      AEBOT_AI_PROVIDER: 'ollama',
      OLLAMA_MODEL: 'qwen3:4b',
    }));

    const result = await service.analyze({
      serviceId: 'reparo-cavalete',
      prompt,
      history: [],
    });

    expect(service.status()).toMatchObject({ aiConfigured: true, aiProvider: 'ollama' });
    expect(result.provider).toBe('ollama');
    expect(result.decision).toBe('Não Conforme');
    expect(result.evaluation.primaryRule?.id).toBe('RULE-RC-07');
  });
});

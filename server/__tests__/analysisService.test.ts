import { afterEach, describe, expect, it, vi } from 'vitest';
import { AebotAnalysisService } from '../analysisService';
import { loadServerConfig } from '../config';

afterEach(() => vi.unstubAllGlobals());

describe('AebotAnalysisService providers', () => {
  it('liga o Gemini online ao mesmo motor determinístico do backend', async () => {
    const prompt = 'não apareceu o momento do torque';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({
          mappings: [{
            ruleId: 'RULE-RC-07',
            sourceQuote: prompt,
            canonicalExpression: 'sem foto durante',
            stance: 'asserted',
          }],
          }) }],
        },
      }],
    }), { status: 200 })));
    const service = new AebotAnalysisService(loadServerConfig({
      GEMINI_API_KEY: 'chave-de-teste',
      GEMINI_MODEL: 'gemini-2.5-flash-lite',
    }));

    const result = await service.analyze({
      serviceId: 'reparo-cavalete',
      prompt,
      history: [],
    });

    expect(service.status()).toMatchObject({
      aiConfigured: true,
      aiProvider: 'gemini',
      aiProviders: ['gemini'],
    });
    expect(result.provider).toBe('gemini');
    expect(result.decision).toBe('Não Conforme');
    expect(result.evaluation.primaryRule?.id).toBe('RULE-RC-07');
  });
});

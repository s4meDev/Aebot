import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderResponse } from '../../src/types';
import { ruleEngine } from '../../src/services/RuleEngine';
import { createAebotServer, type ServerLogger } from '../app';
import type { AnalysisService } from '../analysisService';
import type { ServerConfig } from '../config';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    allowedOrigins: ['chrome-extension://teste'],
    allowChromeExtensionOrigins: false,
    trustProxy: false,
    apiToken: 'token-de-teste',
    analystTokens: [],
    geminiApiKey: '',
    geminiModel: 'gemini-test',
    geminiFallbackModel: 'gemini-fallback-test',
    humanizeDeterministicResponses: false,
    bodyLimitBytes: 32_768,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

function service(): AnalysisService {
  return {
    async analyze(request): Promise<AiProviderResponse> {
      const evaluation = ruleEngine.evaluatePrompt(request.prompt, request.serviceId);
      return {
        provider: 'simulated',
        content: evaluation.reasoningSummary,
        decision: evaluation.decision,
        evaluation,
      };
    },
    listServices: () => ruleEngine.getServices().map((item) => ({
      ...item,
      ruleCount: ruleEngine.getRulesForService(item.id).length,
    })),
    status: () => ({
      ruleStoreVersion: ruleEngine.getRuleStoreVersion(),
      aiConfigured: false,
      aiProvider: 'none',
      aiProviders: [],
      geminiConfigured: false,
    }),
  };
}

async function start(config = testConfig()): Promise<{ url: string; logger: ServerLogger }> {
  const logger = { info: vi.fn(), error: vi.fn() };
  const server = createAebotServer({ config, analysisService: service(), logger });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${address.port}`, logger };
}

describe('API AEBOT', () => {
  it('explica a função do backend na rota inicial', async () => {
    const { url } = await start();
    const response = await fetch(url);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.message).toContain('interface fica na extensão do Chrome');
  });

  it('expõe health sem autenticação e sem dados sensíveis', async () => {
    const { url } = await start();
    const response = await fetch(`${url}/health`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', service: 'aebot-api', geminiConfigured: false });
    expect(body.aiMetrics).toBeUndefined();
  });

  it('exige token nos endpoints operacionais', async () => {
    const { url } = await start();
    expect((await fetch(`${url}/v1/services`)).status).toBe(401);
  });

  it('entrega catálogo central autenticado com a versão da base', async () => {
    const { url } = await start();
    const response = await fetch(`${url}/v1/services`, {
      headers: { Authorization: 'Bearer token-de-teste' },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ruleStoreVersion).toBe(ruleEngine.getRuleStoreVersion());
    expect(body.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'reparo-cavalete',
        ruleCount: ruleEngine.getRulesForService('reparo-cavalete').length,
      }),
    ]));
  });

  it('identifica token individual sem registrar o conteúdo da análise', async () => {
    const { url, logger } = await start(testConfig({
      apiToken: '',
      analystTokens: [{ analystId: 'analista-01', token: 'token-individual-seguro' }],
    }));
    const response = await fetch(`${url}/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-individual-seguro',
      },
      body: JSON.stringify({
        serviceId: 'reparo-cavalete',
        prompt: 'sem foto depois',
        history: [],
      }),
    });
    expect(response.status).toBe(200);
    const logs = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(logs).toContain('analista-01');
    expect(logs).not.toContain('sem foto depois');
  });

  it('aplica a capacidade por analista mesmo quando compartilham a mesma rede', async () => {
    const { url } = await start(testConfig({
      apiToken: '',
      rateLimitPerMinute: 1,
      analystTokens: [
        { analystId: 'analista-01', token: 'token-individual-01' },
        { analystId: 'analista-02', token: 'token-individual-02' },
      ],
    }));
    const first = await fetch(`${url}/v1/services`, {
      headers: { Authorization: 'Bearer token-individual-01' },
    });
    const second = await fetch(`${url}/v1/services`, {
      headers: { Authorization: 'Bearer token-individual-02' },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('avalia pelo mesmo motor determinístico e não registra a pergunta', async () => {
    const { url, logger } = await start();
    const response = await fetch(`${url}/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-de-teste',
        Origin: 'chrome-extension://teste',
      },
      body: JSON.stringify({ serviceId: 'reparo-cavalete', prompt: 'sem foto depois', history: [] }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.decision).toBe('Reprovado');
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain('sem foto depois');
  });

  it('recusa origem, payload inválido e excesso de requisições', async () => {
    const blocked = await start();
    expect((await fetch(`${blocked.url}/v1/services`, {
      headers: { Origin: 'https://invasor.example', Authorization: 'Bearer token-de-teste' },
    })).status).toBe(403);

    const invalid = await start();
    expect((await fetch(`${invalid.url}/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-de-teste' },
      body: JSON.stringify({ serviceId: 'reparo-cavalete', prompt: '' }),
    })).status).toBe(400);

    const limited = await start(testConfig({ rateLimitPerMinute: 1 }));
    expect((await fetch(`${limited.url}/health`)).status).toBe(200);
    expect((await fetch(`${limited.url}/health`)).status).toBe(429);
  });

  it('só usa o IP encaminhado quando o proxy é explicitamente confiável', async () => {
    const trusted = await start(testConfig({ trustProxy: true, rateLimitPerMinute: 1 }));
    expect((await fetch(`${trusted.url}/health`, {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    })).status).toBe(200);
    expect((await fetch(`${trusted.url}/health`, {
      headers: { 'X-Forwarded-For': '203.0.113.11' },
    })).status).toBe(200);

    const cloudflare = await start(testConfig({ trustProxy: true, rateLimitPerMinute: 1 }));
    expect((await fetch(`${cloudflare.url}/health`, {
      headers: { 'CF-Connecting-IP': '203.0.113.20' },
    })).status).toBe(200);
    expect((await fetch(`${cloudflare.url}/health`, {
      headers: { 'CF-Connecting-IP': '203.0.113.21' },
    })).status).toBe(200);
  });

  it('protege o diagnóstico operacional por autenticação', async () => {
    const { url } = await start();
    expect((await fetch(`${url}/v1/status`)).status).toBe(401);
    const response = await fetch(`${url}/v1/status`, {
      headers: { Authorization: 'Bearer token-de-teste' },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      ruleStoreVersion: ruleEngine.getRuleStoreVersion(),
      aiConfigured: false,
    });
    expect(body.uptimeSeconds).toEqual(expect.any(Number));
    expect(JSON.stringify(body)).not.toContain('token-de-teste');
  });
});

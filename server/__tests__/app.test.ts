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
    status: () => ({ ruleStoreVersion: ruleEngine.getRuleStoreVersion(), geminiConfigured: false }),
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
  });

  it('exige token nos endpoints operacionais', async () => {
    const { url } = await start();
    expect((await fetch(`${url}/v1/services`)).status).toBe(401);
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
  });
});

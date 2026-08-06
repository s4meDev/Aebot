import { describe, expect, it, vi } from 'vitest';
import { ruleEngine } from '../../src/services/RuleEngine';
import { createWorkerApp, type WorkerEnvironment } from '../app';
import { createFakeD1 } from './fakeD1';

const TOKEN = 'token-individual-com-mais-de-trinta-e-dois-caracteres';
const ADMIN_TOKEN = 'token-administrativo-separado-e-com-mais-de-trinta-caracteres';
const ORIGIN = `chrome-extension://${'a'.repeat(32)}`;

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function environment(extra: Partial<WorkerEnvironment> = {}): Promise<WorkerEnvironment> {
  return {
    AEBOT_ALLOWED_ORIGINS: ORIGIN,
    AEBOT_TOKEN_HASHES: JSON.stringify({ analista01: await tokenHash(TOKEN) }),
    ANALYST_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    UNAUTHORIZED_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ...extra,
  };
}

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('Origin', ORIGIN);
  return new Request(`https://aebot-api.example.workers.dev${path}`, { ...init, headers });
}

describe('Cloudflare Worker do AEBOT', () => {
  it('expõe saúde sem autenticação e sem acionar o modelo', async () => {
    const run = vi.fn();
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(
      request('/health'),
      await environment({ AI: { run } })
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      runtime: 'cloudflare-worker',
      aiConfigured: true,
      aiProvider: 'workers-ai',
      accessConfigured: true,
      feedbackConfigured: false,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('aceita somente origem exata e token cujo hash foi provisionado', async () => {
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const env = await environment();
    const authorized = await app.fetch(request('/v1/services', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }), env);
    const unauthorized = await app.fetch(request('/v1/services', {
      headers: { Authorization: 'Bearer incorreto' },
    }), env);
    const foreignOrigin = await app.fetch(new Request(
      'https://aebot-api.example.workers.dev/v1/services',
      { headers: { Origin: 'https://invasor.example', Authorization: `Bearer ${TOKEN}` } }
    ), env);

    expect(authorized.status).toBe(200);
    expect(unauthorized.status).toBe(401);
    expect(foreignOrigin.status).toBe(403);
    expect(authorized.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('mantém a decisão no motor compartilhado', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const app = createWorkerApp({ logger });
    const env = await environment();
    const serviceId = ruleEngine.getServices()[0]?.id;
    expect(serviceId).toBeTruthy();
    const response = await app.fetch(request('/v1/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serviceId, prompt: 'sem foto depois', history: [] }),
    }), env);
    const body = await response.json() as {
      result: { decision: string | null; evaluation: { outcome: string } };
    };

    expect(response.status).toBe(200);
    expect(body.result.decision).toBe('Reprovado');
    expect(body.result.evaluation.outcome).toBe('decision');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('sem foto depois');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(TOKEN);
  });

  it('reprova quando a conversa confirma duas etapas distintas sem evidência', async () => {
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(request('/v1/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: ruleEngine.getServices()[0]?.id,
        prompt: 'Mas não tem foto antes também.',
        history: [
          {
            id: 'previous-user',
            role: 'user',
            content: 'Não mostrou o aperto da virola.',
            timestamp: '09:00',
          },
          {
            id: 'previous-answer',
            role: 'assistant',
            content: 'Não Conforme.',
            timestamp: '09:01',
          },
        ],
      }),
    }), await environment());
    const body = await response.json() as {
      result: { decision: string | null; evaluation: { primaryRule: { title: string } | null } };
    };

    expect(response.status).toBe(200);
    expect(body.result.decision).toBe('Reprovado');
    expect(body.result.evaluation.primaryRule?.title).toBe('Ausência de duas ou mais etapas');
  });

  it('usa Workers AI apenas para aterrar linguagem informal e preserva a decisão do motor', async () => {
    const prompt = 'não apareceu o momento do torque';
    const run = vi.fn().mockResolvedValue({
      response: JSON.stringify({
        mappings: [{
          ruleId: 'RULE-RC-07',
          sourceQuote: prompt,
          canonicalExpression: 'sem foto durante',
          stance: 'asserted',
        }],
      }),
    });
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(request('/v1/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: ruleEngine.getServices()[0]?.id,
        prompt,
        history: [],
      }),
    }), await environment({ AI: { run } }));
    const body = await response.json() as {
      result: {
        provider: string;
        decision: string | null;
        evaluation: { semanticInterpretationApplied?: boolean };
      };
    };

    expect(response.status).toBe(200);
    expect(body.result.provider).toBe('workers-ai');
    expect(body.result.decision).toBe('Não Conforme');
    expect(body.result.evaluation.semanticInterpretationApplied).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('aplica rate limit por identidade do analista', async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(request('/v1/services', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }), await environment({ ANALYST_RATE_LIMITER: limiter }));

    expect(response.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'analyst:analista01' });
  });

  it('separa o limite das rotas públicas das tentativas sem autorização', async () => {
    const publicLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const unauthorizedLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const env = await environment({
      PUBLIC_RATE_LIMITER: publicLimiter,
      UNAUTHORIZED_RATE_LIMITER: unauthorizedLimiter,
    });

    expect((await app.fetch(request('/health'), env)).status).toBe(200);
    expect((await app.fetch(request('/v1/services'), env)).status).toBe(401);
    expect(publicLimiter.limit).toHaveBeenCalledWith({ key: 'public:unknown' });
    expect(unauthorizedLimiter.limit).toHaveBeenCalledWith({ key: 'unauthorized:unknown' });
  });

  it('atende uma rajada simultânea equivalente aos 40 analistas', async () => {
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const env = await environment({ ANALYST_RATE_LIMITER: limiter });
    const serviceId = ruleEngine.getServices()[0]?.id;
    const responses = await Promise.all(Array.from({ length: 40 }, () => app.fetch(
      request('/v1/analyze', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceId, prompt: 'sem foto depois', history: [] }),
      }),
      env
    )));

    expect(responses).toHaveLength(40);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(limiter.limit).toHaveBeenCalledTimes(40);
  });

  it('recusa corpos acima do limite antes da avaliação', async () => {
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(request('/v1/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: ruleEngine.getServices()[0]?.id,
        prompt: 'texto muito grande',
        history: [],
      }),
    }), await environment({ AEBOT_BODY_LIMIT_BYTES: '10' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_request' });
  });

  it('salva feedback sem registrar seu texto nos logs', async () => {
    const fake = createFakeD1();
    const logger = { info: vi.fn(), error: vi.fn() };
    const app = createWorkerApp({
      logger,
      randomUUID: vi.fn()
        .mockReturnValueOnce('request-feedback')
        .mockReturnValueOnce('feedback-1'),
      now: () => Date.parse('2026-08-06T12:00:00.000Z'),
    });
    const feedbackText = 'A explicação desta resposta precisa ficar mais clara.';
    const response = await app.fetch(request('/v1/feedback', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: ruleEngine.getServices()[0]?.id,
        category: 'dificuldade_entendimento',
        message: feedbackText,
        appVersion: '2.5.0',
      }),
    }), await environment({ FEEDBACK_DB: fake.database }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'saved',
      feedbackId: 'feedback-1',
    });
    expect(fake.rows).toEqual([expect.objectContaining({
      id: 'feedback-1',
      analyst_id: 'analista01',
      message: feedbackText,
    })]);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(feedbackText);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(TOKEN);
  });

  it('separa o token administrativo e permite consultar feedbacks salvos', async () => {
    const fake = createFakeD1([{
      id: 'feedback-1',
      analyst_id: 'analista01',
      service_id: ruleEngine.getServices()[0]!.id,
      category: 'sugestao',
      message: 'Seria útil uma explicação mais curta.',
      app_version: '2.5.0',
      created_at: '2026-08-06T12:00:00.000Z',
      status: 'new',
    }]);
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const env = await environment({
      FEEDBACK_DB: fake.database,
      AEBOT_ADMIN_TOKEN_HASH: await tokenHash(ADMIN_TOKEN),
    });
    const analystAttempt = await app.fetch(request('/v1/admin/feedback', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }), env);
    const adminResponse = await app.fetch(request('/v1/admin/feedback', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }), env);

    expect(analystAttempt.status).toBe(401);
    expect(adminResponse.status).toBe(200);
    await expect(adminResponse.json()).resolves.toMatchObject({
      feedback: [expect.objectContaining({ id: 'feedback-1', analystId: 'analista01' })],
    });
  });

  it('serve a página administrativa com CSP restritiva', async () => {
    const app = createWorkerApp({ logger: { info: vi.fn(), error: vi.fn() } });
    const response = await app.fetch(
      new Request('https://aebot-api.example.workers.dev/admin'),
      await environment()
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).not.toContain('unsafe-inline');
    expect(html).toContain('Feedback dos analistas');
    expect(html).toContain('src="/admin/app.js"');

    const scriptResponse = await app.fetch(
      new Request('https://aebot-api.example.workers.dev/admin/app.js'),
      await environment()
    );
    const script = await scriptResponse.text();
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('textContent');
    expect(script).toContain('safe.replaceAll');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkBackendAccess,
  checkBackendHealth,
  fetchBackendCatalog,
  getPackagedBackendUrl,
  normalizeBackendUrl,
  resolveBackendUrl,
} from '../BackendClient';

afterEach(() => vi.unstubAllGlobals());

describe('BackendClient', () => {
  it('descobre apenas a origem central do pacote de produção', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ host_permissions: ['https://aebot.example/*'] }),
      },
    });
    expect(getPackagedBackendUrl()).toBe('https://aebot.example');
    expect(resolveBackendUrl('')).toBe('https://aebot.example');
    expect(resolveBackendUrl('http://localhost:8787')).toBe('https://aebot.example');
  });

  it('não interpreta a permissão direta do Gemini como backend central', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({
          host_permissions: ['https://generativelanguage.googleapis.com/*'],
        }),
      },
    });
    expect(getPackagedBackendUrl()).toBe('');
  });

  it.each([
    ['http://127.0.0.1:8787/', 'http://127.0.0.1:8787'],
    ['http://localhost:8787/api/', 'http://localhost:8787/api'],
    ['https://aebot.example/', 'https://aebot.example'],
    ['http://aebot.example', null],
    ['https://usuario:senha@aebot.example', null],
    ['não é url', null],
  ])('normaliza URL segura %s', (input, expected) => {
    expect(normalizeBackendUrl(input)).toBe(expected);
  });

  it('diferencia backend ausente, online e resposta incompatível', async () => {
    await expect(checkBackendHealth('')).resolves.toEqual({ state: 'not_configured' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'ok',
      service: 'aebot-api',
      ruleStoreVersion: '2.3.0',
      geminiConfigured: true,
    }), { status: 200 })));
    await expect(checkBackendHealth('http://localhost:8787')).resolves.toMatchObject({
      state: 'online',
      health: { geminiConfigured: true },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 })));
    await expect(checkBackendHealth('http://localhost:8787')).resolves.toMatchObject({
      state: 'offline',
      message: expect.stringContaining('incompatível'),
    });
  });

  it('reconhece Workers AI no backend online', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      service: 'aebot-api',
      ruleStoreVersion: '2.5.0',
      aiConfigured: true,
      aiProvider: 'workers-ai',
      geminiConfigured: false,
    }), { status: 200 })));

    await expect(checkBackendHealth('https://aebot.example')).resolves.toMatchObject({
      state: 'online',
      health: { aiProvider: 'workers-ai', aiConfigured: true },
    });
  });

  it('retorna estado offline quando a conexão falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(checkBackendHealth('http://localhost:8787')).resolves.toEqual({
      state: 'offline',
      message: 'Não foi possível conectar ao backend.',
    });
  });

  it('valida token, versão e formato do catálogo central', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ruleStoreVersion: '2.4.0',
        services: [{
          id: 'servico-a',
          name: 'Serviço A',
          category: 'Campo',
          summary: 'Resumo',
          insights: ['Diretriz'],
          suggestedQuestions: ['Como analisar?'],
          ruleCount: 3,
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBackendCatalog('https://aebot.example', 'token-seguro')).resolves
      .toMatchObject({
        state: 'online',
        catalog: { ruleStoreVersion: '2.4.0', services: [{ id: 'servico-a' }] },
      });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-seguro' });

    await expect(fetchBackendCatalog('https://aebot.example', 'token-incorreto')).resolves
      .toMatchObject({ state: 'offline', statusCode: 401, message: expect.stringContaining('token') });
  });

  it('recusa acesso operacional quando saúde e catálogo divergem', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        service: 'aebot-api',
        ruleStoreVersion: '2.4.0',
        geminiConfigured: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ruleStoreVersion: '3.0.0',
        services: [{
          id: 'servico-a',
          name: 'Serviço A',
          category: 'Campo',
          summary: 'Resumo',
          insights: [],
          ruleCount: 1,
        }],
      }), { status: 200 })));

    await expect(checkBackendAccess('https://aebot.example', 'token')).resolves.toEqual({
      state: 'offline',
      message: 'O servidor respondeu com versões divergentes da base de regras.',
    });
  });

  it('explica quando a API online ainda não recebeu os tokens', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        service: 'aebot-api',
        ruleStoreVersion: '2.5.0',
        aiConfigured: true,
        aiProvider: 'workers-ai',
        geminiConfigured: false,
        accessConfigured: false,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 })));

    await expect(checkBackendAccess('https://aebot.example', 'token')).resolves.toMatchObject({
      state: 'offline',
      statusCode: 401,
      message: expect.stringContaining('não possui tokens'),
    });
  });
});

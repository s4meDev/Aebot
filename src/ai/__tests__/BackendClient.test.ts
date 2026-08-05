import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBackendHealth, normalizeBackendUrl } from '../BackendClient';

afterEach(() => vi.unstubAllGlobals());

describe('BackendClient', () => {
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

  it('retorna estado offline quando a conexão falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(checkBackendHealth('http://localhost:8787')).resolves.toEqual({
      state: 'offline',
      message: 'Não foi possível conectar ao backend.',
    });
  });
});

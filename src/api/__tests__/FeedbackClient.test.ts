import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { storageAdapter } from '../../storage/StorageAdapter';
import { submitFeedback } from '../FeedbackClient';

afterEach(() => {
  storageAdapter.remove(STORAGE_KEYS.BACKEND_URL);
  storageAdapter.remove(STORAGE_KEYS.BACKEND_TOKEN);
  vi.unstubAllGlobals();
});

describe('FeedbackClient', () => {
  it('não promete salvar sem API online configurada', async () => {
    await expect(submitFeedback({
      serviceId: 'servico-a',
      category: 'sugestao',
      message: 'Uma sugestão suficientemente detalhada.',
    })).resolves.toMatchObject({ state: 'not_configured' });
  });

  it('envia somente o feedback escrito e metadados necessários', async () => {
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, 'https://aebot.example');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, 'token-do-analista');
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ version: '2.5.0', host_permissions: [] }) },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'saved',
      feedbackId: 'feedback-1',
    }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitFeedback({
      serviceId: 'servico-a',
      category: 'interface',
      message: 'O botão poderia ficar mais visível.',
    })).resolves.toEqual({ state: 'saved', feedbackId: 'feedback-1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://aebot.example/v1/feedback');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-do-analista' });
    expect(JSON.parse(String(init.body))).toEqual({
      serviceId: 'servico-a',
      category: 'interface',
      message: 'O botão poderia ficar mais visível.',
      appVersion: '2.5.0',
    });
  });

  it('explica quando o banco ainda não está habilitado', async () => {
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, 'https://aebot.example');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, 'token-do-analista');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));

    await expect(submitFeedback({
      serviceId: 'servico-a',
      category: 'outro',
      message: 'Este feedback ainda não pode ser salvo.',
    })).resolves.toMatchObject({ state: 'unavailable' });
  });
});

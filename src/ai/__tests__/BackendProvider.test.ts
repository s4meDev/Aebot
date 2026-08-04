import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider, AiProviderResponse } from '../../types';
import { ruleEngine } from '../../services/RuleEngine';
import { storageAdapter } from '../../storage/StorageAdapter';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { BackendProvider, normalizeBackendUrl } from '../BackendProvider';

function localResponse(prompt = 'sem foto depois'): AiProviderResponse {
  const evaluation = ruleEngine.evaluatePrompt(prompt, 'reparo-cavalete');
  return {
    provider: 'simulated',
    content: evaluation.reasoningSummary,
    decision: evaluation.decision,
    evaluation,
  };
}

function fallback(response = localResponse()): AiProvider {
  return { generateResponse: vi.fn().mockResolvedValue(response) };
}

afterEach(() => {
  storageAdapter.remove(STORAGE_KEYS.BACKEND_URL);
  storageAdapter.remove(STORAGE_KEYS.BACKEND_TOKEN);
  vi.unstubAllGlobals();
});

describe('BackendProvider', () => {
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

  it('usa o fallback diretamente quando não há backend configurado', async () => {
    const local = fallback();
    const provider = new BackendProvider(local);
    await provider.generateResponse('', 'sem foto depois', {
      id: 'reparo-cavalete', name: 'Reparo de Cavalete',
    });
    expect(local.generateResponse).toHaveBeenCalledOnce();
  });

  it('envia token, histórico sem mensagem de boas-vindas e aceita o contrato válido', async () => {
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, 'http://127.0.0.1:8787');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, 'token-teste');
    const response = localResponse();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { ...response, provider: 'simulated' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new BackendProvider(fallback());
    const result = await provider.generateResponse('', 'sem foto depois', {
      id: 'reparo-cavalete', name: 'Reparo de Cavalete',
    }, [
      { id: 'welcome', role: 'assistant', content: 'Olá', timestamp: '10:00' },
      { id: '1', role: 'user', content: 'caso anterior', timestamp: '10:01' },
    ]);

    expect(result.provider).toBe('backend');
    expect(result.decision).toBe('Reprovado');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-teste' });
    expect(JSON.parse(String(init.body)).history).toHaveLength(1);
  });

  it('não confia em decisão divergente e volta ao motor local', async () => {
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, 'http://localhost:8787');
    const response = localResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { ...response, decision: 'Conforme' },
    }), { status: 200 })));
    const local = fallback();
    const result = await new BackendProvider(local).generateResponse(
      '',
      'sem foto depois',
      { id: 'reparo-cavalete', name: 'Reparo de Cavalete' }
    );
    expect(result.provider).toBe('simulated');
    expect(result.fallbackReason).toBe('backend_error');
    expect(result.content).toContain('modo local');
    expect(local.generateResponse).toHaveBeenCalledOnce();
  });
});

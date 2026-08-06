import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import type { StorageAdapter } from '../../storage/StorageAdapter';
import { ServiceCatalogService } from '../ServiceCatalogService';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, fallback: T): T {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T;
  }

  set<T>(key: string, value: T): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('ServiceCatalogService', () => {
  it('usa a base embarcada quando nenhum backend está configurado', async () => {
    const result = await new ServiceCatalogService({ storage: new MemoryStorage() }).load();
    expect(result).toMatchObject({
      type: 'success',
      source: 'local',
      services: [expect.objectContaining({ id: 'reparo-cavalete' })],
    });
  });

  it('prefere o catálogo autenticado e registra a versão central', async () => {
    const storage = new MemoryStorage();
    storage.set(STORAGE_KEYS.BACKEND_URL, 'https://aebot.example');
    storage.set(STORAGE_KEYS.BACKEND_TOKEN, 'token');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        service: 'aebot-api',
        ruleStoreVersion: '3.0.0',
        geminiConfigured: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ruleStoreVersion: '3.0.0',
        services: [{
          id: 'servico-central',
          name: 'Serviço Central',
          category: 'Campo',
          summary: 'Catálogo atualizado no servidor.',
          insights: ['Diretriz central'],
          ruleCount: 4,
        }],
      }), { status: 200 })));

    const result = await new ServiceCatalogService({ storage }).load();
    expect(result).toMatchObject({
      type: 'success',
      source: 'backend',
      ruleStoreVersion: '3.0.0',
      services: [expect.objectContaining({ id: 'servico-central', businessRules: [] })],
    });
    expect(storage.get(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION, '')).toBe('3.0.0');
  });

  it('explica a contingência local quando o token não acessa o catálogo', async () => {
    const storage = new MemoryStorage();
    storage.set(STORAGE_KEYS.BACKEND_URL, 'https://aebot.example');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'ok',
        service: 'aebot-api',
        ruleStoreVersion: '3.0.0',
        geminiConfigured: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 })));

    const result = await new ServiceCatalogService({ storage }).load();
    expect(result).toMatchObject({
      type: 'success',
      source: 'local',
      warning: expect.stringContaining('token'),
    });
    expect(storage.get(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION, '')).toBe('3.0.0');
  });
});

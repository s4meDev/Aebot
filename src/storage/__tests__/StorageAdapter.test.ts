import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserStorageAdapter } from '../StorageAdapter';

afterEach(() => vi.unstubAllGlobals());

describe('BrowserStorageAdapter', () => {
  it('recupera o token depois que uma nova instância simula o recarregamento', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    new BrowserStorageAdapter().set('aebot_backend_token', 'token-individual');
    const afterReload = new BrowserStorageAdapter();

    expect(afterReload.get('aebot_backend_token', '')).toBe('token-individual');
  });
});

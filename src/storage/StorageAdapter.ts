export interface StorageAdapter {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

class BrowserStorageAdapter implements StorageAdapter {
  private readonly memory = new Map<string, string>();

  /**
   * Faz o parse de um valor armazenado. Se o valor não for um JSON válido,
   * trata como string crua legada (compatibilidade com dados salvos antes
   * desta abstração existir) em vez de descartar silenciosamente.
   */
  private parse<T>(raw: string | null, fallback: T): T {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  get<T>(key: string, fallback: T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return this.parse(window.localStorage.getItem(key), fallback);
      }
    } catch {
      // fallback to memory storage
    }

    return this.parse(this.memory.get(key) ?? null, fallback);
  }

  set<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    this.memory.set(key, serialized);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, serialized);
      }
    } catch {
      // ignore storage write errors
    }
  }

  remove(key: string): void {
    this.memory.delete(key);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore removal errors
    }
  }
}

export const storageAdapter = new BrowserStorageAdapter();

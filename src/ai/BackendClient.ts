const HEALTH_TIMEOUT_MS = 3_000;

export interface BackendHealth {
  status: 'ok';
  service: 'aebot-api';
  ruleStoreVersion: string;
  geminiConfigured: boolean;
}

export type BackendConnection =
  | { state: 'not_configured' }
  | { state: 'online'; health: BackendHealth }
  | { state: 'offline'; message: string };

export function normalizeBackendUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const localHttp =
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return null;
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function parseHealth(value: unknown): BackendHealth | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const health = value as Record<string, unknown>;
  if (
    health.status !== 'ok' ||
    health.service !== 'aebot-api' ||
    typeof health.ruleStoreVersion !== 'string' ||
    typeof health.geminiConfigured !== 'boolean'
  ) {
    return null;
  }
  return {
    status: 'ok',
    service: 'aebot-api',
    ruleStoreVersion: health.ruleStoreVersion,
    geminiConfigured: health.geminiConfigured,
  };
}

export async function checkBackendHealth(rawUrl: string): Promise<BackendConnection> {
  const backendUrl = normalizeBackendUrl(rawUrl);
  if (!backendUrl) return rawUrl.trim()
    ? { state: 'offline', message: 'Endereço do backend inválido.' }
    : { state: 'not_configured' };

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      return { state: 'offline', message: `Servidor respondeu HTTP ${response.status}.` };
    }
    const health = parseHealth(await response.json());
    return health
      ? { state: 'online', health }
      : { state: 'offline', message: 'O servidor respondeu em um formato incompatível.' };
  } catch {
    return { state: 'offline', message: 'Não foi possível conectar ao backend.' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

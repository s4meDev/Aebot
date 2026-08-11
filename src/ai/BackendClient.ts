import type { DataService, ServiceParameterization } from '../types';

const HEALTH_TIMEOUT_MS = 3_000;
const CATALOG_TIMEOUT_MS = 5_000;

export interface BackendHealth {
  status: 'ok';
  service: 'aebot-api';
  ruleStoreVersion: string;
  aiConfigured: boolean;
  aiProvider: 'gemini' | 'ollama' | 'workers-ai' | 'none';
  /** Indica se o backend possui ao menos uma credencial de acesso cadastrada. */
  accessConfigured?: boolean;
  feedbackConfigured?: boolean;
  adminConfigured?: boolean;
  /** Mantido para compatibilidade com backends 2.2 anteriores. */
  geminiConfigured: boolean;
}

export type BackendConnection =
  | { state: 'not_configured' }
  | { state: 'online'; health: BackendHealth }
  | { state: 'offline'; message: string };

export interface BackendCatalog {
  ruleStoreVersion: string;
  services: Array<DataService & { ruleCount: number }>;
}

export type BackendCatalogConnection =
  | { state: 'not_configured' }
  | { state: 'online'; catalog: BackendCatalog }
  | { state: 'offline'; message: string; statusCode?: number };

export type BackendAccessConnection =
  | { state: 'not_configured' }
  | { state: 'online'; health: BackendHealth; catalog: BackendCatalog }
  | { state: 'offline'; message: string; statusCode?: number; health?: BackendHealth };

/**
 * Em pacotes de produção há uma única origem HTTPS no manifest. Ela funciona
 * como configuração segura de fábrica, sem incorporar token ou outro segredo.
 */
export function getPackagedBackendUrl(): string {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) return '';
  const permissions = chrome.runtime.getManifest().host_permissions ?? [];
  const candidates = permissions
    .filter((permission) => permission.startsWith('https://'))
    .filter((permission) => !permission.includes('generativelanguage.googleapis.com'))
    .map((permission) => permission.replace(/\/\*$/, ''));
  if (candidates.length !== 1) return '';
  return normalizeBackendUrl(candidates[0]) ?? '';
}

export function resolveBackendUrl(configuredValue: string): string {
  return getPackagedBackendUrl() || normalizeBackendUrl(configuredValue) || '';
}

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
    typeof health.geminiConfigured !== 'boolean' ||
    (health.accessConfigured !== undefined && typeof health.accessConfigured !== 'boolean') ||
    (health.feedbackConfigured !== undefined && typeof health.feedbackConfigured !== 'boolean') ||
    (health.adminConfigured !== undefined && typeof health.adminConfigured !== 'boolean') ||
    (health.aiConfigured !== undefined && typeof health.aiConfigured !== 'boolean') ||
    (health.aiProvider !== undefined && !['gemini', 'ollama', 'workers-ai', 'none'].includes(String(health.aiProvider)))
  ) {
    return null;
  }
  return {
    status: 'ok',
    service: 'aebot-api',
    ruleStoreVersion: health.ruleStoreVersion,
    aiConfigured: typeof health.aiConfigured === 'boolean'
      ? health.aiConfigured
      : health.geminiConfigured,
    aiProvider: health.aiProvider === 'ollama' || health.aiProvider === 'gemini' || health.aiProvider === 'workers-ai'
      ? health.aiProvider
      : health.geminiConfigured
        ? 'gemini'
        : 'none',
    geminiConfigured: health.geminiConfigured,
    accessConfigured: health.accessConfigured as boolean | undefined,
    feedbackConfigured: health.feedbackConfigured as boolean | undefined,
    adminConfigured: health.adminConfigured as boolean | undefined,
  };
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseParameterization(value: unknown): ServiceParameterization | null | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const supportedKeys = [
    'serviceExchange',
    'executedAdditional',
    'subsequentAdditional',
  ] as const;
  if (Object.keys(source).some((key) => !supportedKeys.includes(
    key as typeof supportedKeys[number]
  ))) return null;
  const result: ServiceParameterization = {};
  for (const key of supportedKeys) {
    if (source[key] === undefined) continue;
    if (
      !isStringList(source[key]) ||
      source[key].some((item) => !item.trim()) ||
      new Set(source[key]).size !== source[key].length
    ) return null;
    result[key] = source[key];
  }
  return result;
}

function parseCatalog(value: unknown): BackendCatalog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.ruleStoreVersion !== 'string' || !Array.isArray(source.services)) return null;

  const services = source.services.flatMap((value): BackendCatalog['services'] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const service = value as Record<string, unknown>;
    const parameterization = parseParameterization(service.parameterization);
    if (
      typeof service.id !== 'string' || !service.id ||
      typeof service.name !== 'string' || !service.name ||
      typeof service.category !== 'string' || !service.category ||
      typeof service.summary !== 'string' || !service.summary ||
      !isStringList(service.insights) ||
      (service.suggestedQuestions !== undefined && !isStringList(service.suggestedQuestions)) ||
      (service.analysisStatus !== undefined && !['active', 'rules_pending'].includes(String(service.analysisStatus))) ||
      (service.catalogNameStatus !== undefined && !['confirmed', 'needs_confirmation'].includes(String(service.catalogNameStatus))) ||
      (service.sourceLabel !== undefined && typeof service.sourceLabel !== 'string') ||
      parameterization === null ||
      !Number.isInteger(service.ruleCount) || (service.ruleCount as number) < 0
    ) {
      return [];
    }
    return [{
      id: service.id,
      name: service.name,
      category: service.category,
      summary: service.summary,
      insights: service.insights,
      suggestedQuestions: service.suggestedQuestions as string[] | undefined,
      analysisStatus: service.analysisStatus as DataService['analysisStatus'],
      parameterization,
      catalogNameStatus: service.catalogNameStatus as DataService['catalogNameStatus'],
      sourceLabel: service.sourceLabel as string | undefined,
      ruleCount: service.ruleCount as number,
    }];
  });
  if (!services.length || services.length !== source.services.length) return null;
  const serviceIds = new Set(services.map((service) => service.id));
  const hasBrokenRelation = services.some((service) => (
    Object.values(service.parameterization ?? {}) as Array<string[] | undefined>
  ).some((targetIds) => targetIds?.some((targetId: string) => (
    targetId === service.id || !serviceIds.has(targetId)
  ))));
  if (hasBrokenRelation) return null;
  return { ruleStoreVersion: source.ruleStoreVersion, services };
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

/** Valida também o acesso autenticado ao catálogo, não apenas a rota pública de saúde. */
export async function fetchBackendCatalog(
  rawUrl: string,
  token = ''
): Promise<BackendCatalogConnection> {
  const backendUrl = normalizeBackendUrl(rawUrl);
  if (!backendUrl) return rawUrl.trim()
    ? { state: 'offline', message: 'Endereço do backend inválido.' }
    : { state: 'not_configured' };

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendUrl}/v1/services`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {},
    });
    if (!response.ok) {
      const message = response.status === 401
        ? 'O servidor está ativo, mas o token não autoriza o acesso ao catálogo.'
        : `O catálogo respondeu HTTP ${response.status}.`;
      return { state: 'offline', message, statusCode: response.status };
    }
    const catalog = parseCatalog(await response.json());
    return catalog
      ? { state: 'online', catalog }
      : { state: 'offline', message: 'O catálogo respondeu em um formato incompatível.' };
  } catch {
    return { state: 'offline', message: 'Não foi possível carregar o catálogo central.' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

/** Diagnóstico operacional único usado pela configuração, catálogo e chat. */
export async function checkBackendAccess(
  rawUrl: string,
  token = ''
): Promise<BackendAccessConnection> {
  if (!normalizeBackendUrl(rawUrl)) {
    return rawUrl.trim()
      ? { state: 'offline', message: 'Endereço do backend inválido.' }
      : { state: 'not_configured' };
  }
  const [health, catalog] = await Promise.all([
    checkBackendHealth(rawUrl),
    fetchBackendCatalog(rawUrl, token),
  ]);
  if (health.state !== 'online') return health;
  if (catalog.state !== 'online') {
    if (
      catalog.state === 'offline' &&
      catalog.statusCode === 401 &&
      health.health.accessConfigured === false
    ) {
      return {
        ...catalog,
        health: health.health,
        message: 'A API está ativa, mas ainda não possui tokens de analistas configurados.',
      };
    }
    return catalog.state === 'offline'
      ? { ...catalog, health: health.health }
      : catalog;
  }
  if (health.health.ruleStoreVersion !== catalog.catalog.ruleStoreVersion) {
    return {
      state: 'offline',
      message: 'O servidor respondeu com versões divergentes da base de regras.',
    };
  }
  return { state: 'online', health: health.health, catalog: catalog.catalog };
}

import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL } from '../src/localConfig';

export interface ServerConfig {
  host: string;
  port: number;
  allowedOrigins: string[];
  allowChromeExtensionOrigins: boolean;
  trustProxy: boolean;
  apiToken: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiFallbackModel: string;
  humanizeDeterministicResponses: boolean;
  bodyLimitBytes: number;
  rateLimitPerMinute: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAllowedOrigin(value: string, isProduction: boolean): string {
  const candidate = value.trim().replace(/\/$/, '');
  if (candidate.includes('*')) throw new Error(`Origem CORS inválida: ${value}`);
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    const localHttp =
      !isProduction &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (
      (url.protocol !== 'https:' && !localHttp) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new Error(`Origem CORS inválida: ${value}`);
  }
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = (env.AEBOT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => normalizeAllowedOrigin(origin, isProduction));
  const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

  if (isProduction && uniqueAllowedOrigins.length === 0) {
    throw new Error('AEBOT_ALLOWED_ORIGINS é obrigatório em produção.');
  }
  if (isProduction && !env.AEBOT_API_TOKEN?.trim()) {
    throw new Error('AEBOT_API_TOKEN é obrigatório em produção.');
  }
  if (isProduction && (env.AEBOT_API_TOKEN?.trim().length ?? 0) < 32) {
    throw new Error('AEBOT_API_TOKEN deve possuir ao menos 32 caracteres em produção.');
  }

  return {
    host: env.AEBOT_HOST?.trim() || '127.0.0.1',
    port: positiveInteger(env.AEBOT_PORT, 8787),
    allowedOrigins: uniqueAllowedOrigins,
    allowChromeExtensionOrigins: !isProduction,
    trustProxy: env.AEBOT_TRUST_PROXY?.trim().toLowerCase() === 'true',
    apiToken: env.AEBOT_API_TOKEN?.trim() ?? '',
    geminiApiKey: env.GEMINI_API_KEY?.trim() ?? '',
    geminiModel: env.GEMINI_MODEL?.trim() || GEMINI_MODEL,
    geminiFallbackModel: env.GEMINI_FALLBACK_MODEL?.trim() || GEMINI_FALLBACK_MODEL,
    humanizeDeterministicResponses:
      env.AEBOT_HUMANIZE_DETERMINISTIC?.trim().toLowerCase() === 'true',
    bodyLimitBytes: positiveInteger(env.AEBOT_BODY_LIMIT_BYTES, 32_768),
    rateLimitPerMinute: positiveInteger(env.AEBOT_RATE_LIMIT_PER_MINUTE, 240),
  };
}

export function isOriginAllowed(origin: string | undefined, config: ServerConfig): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (config.allowedOrigins.includes(normalized)) return true;
  return config.allowChromeExtensionOrigins && normalized.startsWith('chrome-extension://');
}

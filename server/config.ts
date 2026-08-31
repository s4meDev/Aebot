import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL } from '../src/localConfig';

export interface AnalystAccessToken {
  analystId: string;
  token: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  allowedOrigins: string[];
  allowChromeExtensionOrigins: boolean;
  trustProxy: boolean;
  apiToken: string;
  analystTokens: AnalystAccessToken[];
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

function parseAnalystTokens(value: string | undefined, isProduction: boolean): AnalystAccessToken[] {
  const candidate = value?.trim();
  if (!candidate) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('AEBOT_API_TOKENS deve ser um objeto JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AEBOT_API_TOKENS deve mapear analystId para token.');
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (!entries.length || entries.length > 100) {
    throw new Error('AEBOT_API_TOKENS deve conter entre 1 e 100 analistas.');
  }
  const tokens = entries.map(([analystId, token]) => {
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(analystId)) {
      throw new Error(`analystId inválido em AEBOT_API_TOKENS: ${analystId}`);
    }
    if (typeof token !== 'string' || !token.trim() || (isProduction && token.trim().length < 32)) {
      throw new Error(`Token inválido para ${analystId} em AEBOT_API_TOKENS.`);
    }
    return { analystId, token: token.trim() };
  });
  if (new Set(tokens.map((entry) => entry.token)).size !== tokens.length) {
    throw new Error('AEBOT_API_TOKENS não pode reutilizar o mesmo token para analistas diferentes.');
  }
  return tokens;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = (env.AEBOT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => normalizeAllowedOrigin(origin, isProduction));
  const uniqueAllowedOrigins = [...new Set(allowedOrigins)];
  const analystTokens = parseAnalystTokens(env.AEBOT_API_TOKENS, isProduction);

  if (isProduction && uniqueAllowedOrigins.length === 0) {
    throw new Error('AEBOT_ALLOWED_ORIGINS é obrigatório em produção.');
  }
  if (isProduction && !env.AEBOT_API_TOKEN?.trim() && analystTokens.length === 0) {
    throw new Error('AEBOT_API_TOKEN ou AEBOT_API_TOKENS é obrigatório em produção.');
  }
  if (
    isProduction &&
    env.AEBOT_API_TOKEN?.trim() &&
    env.AEBOT_API_TOKEN.trim().length < 32
  ) {
    throw new Error('AEBOT_API_TOKEN deve possuir ao menos 32 caracteres em produção.');
  }

  return {
    host: env.AEBOT_HOST?.trim() || '127.0.0.1',
    port: positiveInteger(env.AEBOT_PORT, 8787),
    allowedOrigins: uniqueAllowedOrigins,
    allowChromeExtensionOrigins: !isProduction,
    trustProxy: env.AEBOT_TRUST_PROXY?.trim().toLowerCase() === 'true',
    apiToken: env.AEBOT_API_TOKEN?.trim() ?? '',
    analystTokens,
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

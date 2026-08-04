import { GEMINI_MODEL } from '../src/localConfig';

export interface ServerConfig {
  host: string;
  port: number;
  allowedOrigins: string[];
  allowChromeExtensionOrigins: boolean;
  apiToken: string;
  geminiApiKey: string;
  geminiModel: string;
  bodyLimitBytes: number;
  rateLimitPerMinute: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = (env.AEBOT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('AEBOT_ALLOWED_ORIGINS é obrigatório em produção.');
  }
  if (isProduction && !env.AEBOT_API_TOKEN?.trim()) {
    throw new Error('AEBOT_API_TOKEN é obrigatório em produção.');
  }

  return {
    host: env.AEBOT_HOST?.trim() || '127.0.0.1',
    port: positiveInteger(env.AEBOT_PORT, 8787),
    allowedOrigins,
    allowChromeExtensionOrigins: !isProduction,
    apiToken: env.AEBOT_API_TOKEN?.trim() ?? '',
    geminiApiKey: env.GEMINI_API_KEY?.trim() ?? '',
    geminiModel: env.GEMINI_MODEL?.trim() || GEMINI_MODEL,
    bodyLimitBytes: positiveInteger(env.AEBOT_BODY_LIMIT_BYTES, 32_768),
    rateLimitPerMinute: positiveInteger(env.AEBOT_RATE_LIMIT_PER_MINUTE, 60),
  };
}

export function isOriginAllowed(origin: string | undefined, config: ServerConfig): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (config.allowedOrigins.includes(normalized)) return true;
  return config.allowChromeExtensionOrigins && normalized.startsWith('chrome-extension://');
}

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isIP, type Socket } from 'node:net';
import { isOriginAllowed, type ServerConfig } from './config';
import { parseAnalyzeRequest, RequestValidationError } from './contracts';
import type { AnalysisService } from './analysisService';

export interface ServerLogger {
  info(entry: Record<string, unknown>): void;
  error(entry: Record<string, unknown>): void;
}

interface ServerDependencies {
  config: ServerConfig;
  analysisService: AnalysisService;
  logger?: ServerLogger;
}

interface RateEntry {
  count: number;
  resetAt: number;
}

class FixedWindowRateLimiter {
  private readonly clients = new Map<string, RateEntry>();
  private requestCount = 0;

  constructor(private readonly limit: number) {}

  allow(key: string, now = Date.now()): boolean {
    // A limpeza periódica impede que IPs antigos fiquem guardados para sempre.
    this.requestCount += 1;
    if (this.requestCount % 100 === 0) {
      for (const [clientKey, entry] of this.clients) {
        if (now >= entry.resetAt) this.clients.delete(clientKey);
      }
    }
    const current = this.clients.get(key);
    if (!current || now >= current.resetAt) {
      this.clients.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}

function clientAddress(request: IncomingMessage, socket: Socket, trustProxy: boolean): string {
  if (trustProxy) {
    const cloudflareAddress = request.headers['cf-connecting-ip'];
    const cloudflareCandidate = Array.isArray(cloudflareAddress)
      ? cloudflareAddress[0]
      : cloudflareAddress;
    if (cloudflareCandidate && isIP(cloudflareCandidate.trim())) {
      return cloudflareCandidate.trim();
    }
    const forwarded = request.headers['x-forwarded-for'];
    const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    if (candidate && isIP(candidate)) return candidate;
  }
  return socket.remoteAddress ?? 'unknown';
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
  requestId: string,
  origin?: string
): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Request-Id', requestId);
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new RequestValidationError(['corpo excede o limite permitido']);
    chunks.push(buffer);
  }
  if (!chunks.length) throw new RequestValidationError(['corpo JSON ausente']);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new RequestValidationError(['JSON inválido']);
  }
}

function tokensEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

function authorizedIdentity(request: IncomingMessage, config: ServerConfig): string | null {
  // Sem tokens configurados, o servidor Node fica em modo de desenvolvimento local.
  if (!config.apiToken && config.analystTokens.length === 0) return 'development';
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const provided = authorization.slice(7);
  if (config.apiToken && tokensEqual(provided, config.apiToken)) return 'shared';
  for (const access of config.analystTokens) {
    if (tokensEqual(provided, access.token)) return access.analystId;
  }
  return null;
}

export function createAebotServer(dependencies: ServerDependencies): Server {
  const { config, analysisService } = dependencies;
  const logger = dependencies.logger ?? console;
  const limiter = new FixedWindowRateLimiter(config.rateLimitPerMinute);

  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const path = new URL(request.url ?? '/', 'http://aebot.local').pathname;

    const finish = (statusCode: number, extra: Record<string, unknown> = {}) => {
      logger.info({
        requestId,
        method: request.method,
        path,
        statusCode,
        durationMs: Date.now() - startedAt,
        ...extra,
      });
    };

    if (!isOriginAllowed(origin, config)) {
      writeJson(response, 403, { error: 'origin_not_allowed', requestId }, requestId);
      finish(403);
      return;
    }

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.setHeader('Access-Control-Max-Age', '600');
      if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
      response.end();
      finish(204);
      return;
    }

    const isPublicEndpoint = path === '/' || path === '/health';
    const analystId = isPublicEndpoint ? undefined : authorizedIdentity(request, config);
    if (!isPublicEndpoint && !analystId) {
      const unauthorizedKey = `unauthorized:${clientAddress(
        request,
        request.socket,
        config.trustProxy
      )}`;
      if (!limiter.allow(unauthorizedKey)) {
        writeJson(response, 429, { error: 'rate_limit_exceeded', requestId }, requestId, origin);
        finish(429);
        return;
      }
      writeJson(response, 401, { error: 'unauthorized', requestId }, requestId, origin);
      finish(401);
      return;
    }

    const rateLimitKey = analystId
      ? `analyst:${analystId}`
      : `public:${clientAddress(request, request.socket, config.trustProxy)}`;
    if (!limiter.allow(rateLimitKey)) {
      writeJson(response, 429, { error: 'rate_limit_exceeded', requestId }, requestId, origin);
      finish(429);
      return;
    }

    try {
      if (request.method === 'GET' && path === '/') {
        writeJson(response, 200, {
          status: 'ok',
          service: 'aebot-api',
          message: 'Backend do AEBOT ativo. Ele centraliza o motor de regras e a integração com IA; a interface fica na extensão do Chrome.',
          health: '/health',
          requestId,
        }, requestId, origin);
        finish(200);
        return;
      }

      if (request.method === 'GET' && path === '/health') {
        const status = analysisService.status();
        writeJson(response, 200, {
          status: 'ok',
          service: 'aebot-api',
          ruleStoreVersion: status.ruleStoreVersion,
          aiConfigured: status.aiConfigured,
          aiProvider: status.aiProvider,
          geminiConfigured: status.geminiConfigured,
          accessConfigured: Boolean(config.apiToken || config.analystTokens.length),
          feedbackConfigured: false,
          adminConfigured: false,
          requestId,
        }, requestId, origin);
        finish(200);
        return;
      }

      if (request.method === 'GET' && path === '/v1/services') {
        const status = analysisService.status();
        writeJson(response, 200, {
          ruleStoreVersion: status.ruleStoreVersion,
          services: analysisService.listServices(),
          requestId,
        }, requestId, origin);
        finish(200);
        return;
      }

      if (request.method === 'GET' && path === '/v1/status') {
        writeJson(response, 200, {
          status: 'ok',
          uptimeSeconds: Math.floor(process.uptime()),
          ...analysisService.status(),
          requestId,
        }, requestId, origin);
        finish(200, { analystId });
        return;
      }

      if (request.method === 'POST' && path === '/v1/analyze') {
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          throw new RequestValidationError(['Content-Type deve ser application/json']);
        }
        const input = parseAnalyzeRequest(await readJson(request, config.bodyLimitBytes));
        const result = await analysisService.analyze(input);
        writeJson(response, 200, { result, requestId }, requestId, origin);
        finish(200, {
          outcome: result.evaluation.outcome,
          decision: result.decision,
          provider: result.provider,
          analystId,
        });
        return;
      }

      writeJson(response, 404, { error: 'not_found', requestId }, requestId, origin);
      finish(404);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        writeJson(response, 400, {
          error: 'invalid_request',
          issues: error.issues,
          requestId,
        }, requestId, origin);
        finish(400);
        return;
      }
      logger.error({
        requestId,
        path,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      writeJson(response, 500, { error: 'internal_error', requestId }, requestId, origin);
      finish(500);
    }
  });
}

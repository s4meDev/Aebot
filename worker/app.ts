import { GeminiModelClient } from '../src/ai/GeminiProvider';
import {
  FallbackStructuredModelClient,
  type StructuredModelClient,
} from '../src/ai/StructuredModelClient';
import {
  DEFAULT_WORKERS_AI_MODEL,
  WorkersAiModelClient,
  type WorkersAiBinding,
} from '../src/ai/WorkersAiModelClient';
import { parseAnalyzeRequest, RequestValidationError } from '../src/api/contracts';
import {
  FeedbackValidationError,
  parseFeedbackCategory,
  parseFeedbackSubmission,
} from '../src/api/feedbackContracts';
import {
  AebotAnalysisService,
  type AnalysisService,
} from '../src/services/AnalysisService';
import { adminAssetResponse } from './adminPage';
import {
  deleteFeedback,
  listFeedback,
  saveFeedback,
  type D1Database,
} from './feedbackRepository';
import {
  getOperationalMetrics,
  recordAnalysisMetrics,
  recordFeedbackMetrics,
  type OperationalMetrics,
} from './metricsRepository';

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnvironment {
  AI?: WorkersAiBinding;
  ANALYST_RATE_LIMITER?: RateLimitBinding;
  PUBLIC_RATE_LIMITER?: RateLimitBinding;
  UNAUTHORIZED_RATE_LIMITER?: RateLimitBinding;
  AEBOT_ALLOWED_ORIGINS?: string;
  AEBOT_TOKEN_HASHES?: string;
  AEBOT_ADMIN_TOKEN_HASH?: string;
  AEBOT_WORKERS_AI_MODEL?: string;
  AEBOT_WORKERS_AI_FALLBACK_MODELS?: string;
  AEBOT_AI_PROVIDER_ORDER?: string;
  AEBOT_HUMANIZE_DETERMINISTIC?: string;
  AEBOT_BODY_LIMIT_BYTES?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
  FEEDBACK_DB?: D1Database;
}

export interface WorkerLogger {
  info(entry: Record<string, unknown>): void;
  error(entry: Record<string, unknown>): void;
}

interface WorkerDependencies {
  createAnalysisService?: (env: WorkerEnvironment) => AnalysisService;
  logger?: WorkerLogger;
  randomUUID?: () => string;
  now?: () => number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const DEFAULT_BODY_LIMIT = 32_768;
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function booleanValue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function createModelClient(env: WorkerEnvironment): StructuredModelClient | null {
  const workersModels = [
    env.AEBOT_WORKERS_AI_MODEL?.trim() || DEFAULT_WORKERS_AI_MODEL,
    ...(env.AEBOT_WORKERS_AI_FALLBACK_MODELS?.split(',').map((model) => model.trim()) ?? []),
  ].filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);
  const workersAi = env.AI
    ? workersModels.slice(1).reduce<StructuredModelClient>(
        (chain, model) => new FallbackStructuredModelClient(
          chain,
          new WorkersAiModelClient(env.AI!, model)
        ),
        new WorkersAiModelClient(env.AI, workersModels[0])
      )
    : null;
  const geminiKey = env.GEMINI_API_KEY?.trim() ?? '';
  const gemini = geminiKey
    ? new GeminiModelClient(
        geminiKey,
        env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
        env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL
      )
    : null;
  if (workersAi && gemini) {
    const requestedOrder = env.AEBOT_AI_PROVIDER_ORDER?.trim().toLowerCase();
    return requestedOrder === 'workers-ai,gemini'
      ? new FallbackStructuredModelClient(workersAi, gemini)
      : new FallbackStructuredModelClient(gemini, workersAi);
  }
  return workersAi ?? gemini;
}

const WORKERS_AI_FREE_NEURONS_PER_DAY = 10_000;
const WORKERS_AI_NEURONS_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  '@cf/openai/gpt-oss-20b': { input: 18_182, output: 27_273 },
  '@cf/qwen/qwen3-30b-a3b-fp8': { input: 4_625, output: 30_475 },
};

function quotaOverview(metrics: OperationalMetrics) {
  const todayModels = metrics.models.filter((row) => row.day === metrics.period.endDay);
  const geminiRows = todayModels.filter((row) => row.provider === 'gemini');
  const workersRows = todayModels.filter((row) => row.provider === 'workers-ai');
  const geminiRequests = geminiRows.reduce((sum, row) => sum + Number(row.request_count), 0);
  const geminiTokens = geminiRows.reduce(
    (sum, row) => sum + Number(row.input_tokens) + Number(row.output_tokens),
    0
  );
  const workersEstimateComplete = workersRows.every((row) =>
    Boolean(WORKERS_AI_NEURONS_PER_MILLION_TOKENS[row.model]) &&
    (Number(row.request_count) === 0 || Number(row.input_tokens) + Number(row.output_tokens) > 0)
  );
  const estimatedWorkersNeurons = workersEstimateComplete
    ? workersRows.reduce((sum, row) => {
        const rate = WORKERS_AI_NEURONS_PER_MILLION_TOKENS[row.model];
        if (!rate) return sum;
        return sum +
          Number(row.input_tokens) * rate.input / 1_000_000 +
          Number(row.output_tokens) * rate.output / 1_000_000;
      }, 0)
    : null;
  return {
    gemini: {
      measuredRequestsToday: geminiRequests,
      measuredTokensToday: geminiTokens || null,
      remainingQuotaAvailableHere: false,
      quotaScope: 'project',
      dashboardUrl: 'https://aistudio.google.com/usage',
      note: 'O Gemini não expõe ao AEBOT a cota restante do projeto. Consulte os limites ativos no Google AI Studio.',
    },
    workersAi: {
      freeDailyNeurons: WORKERS_AI_FREE_NEURONS_PER_DAY,
      estimatedNeuronsToday: estimatedWorkersNeurons === null
        ? null
        : Math.round(estimatedWorkersNeurons * 100) / 100,
      estimateComplete: workersEstimateComplete,
      dashboardUrl: 'https://dash.cloudflare.com/',
      note: workersEstimateComplete
        ? 'Estimativa calculada pelos tokens reportados e pelas tarifas públicas de neurons dos modelos configurados.'
        : 'O provedor não reportou tokens em todas as tentativas; consulte o painel Cloudflare para o consumo oficial.',
    },
  };
}

export function createCloudAnalysisService(env: WorkerEnvironment): AnalysisService {
  return new AebotAnalysisService({
    modelClient: createModelClient(env),
    humanizeDeterministicResponses: booleanValue(env.AEBOT_HUMANIZE_DETERMINISTIC),
    geminiConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
  });
}

function normalizedAllowedOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const rawOrigin of value?.split(',') ?? []) {
    const origin = rawOrigin.trim().replace(/\/$/, '');
    if (!origin) continue;
    if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      origins.add(origin);
      continue;
    }
    try {
      const url = new URL(origin);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        continue;
      }
      origins.add(url.origin);
    } catch {
      // Uma origem inválida nunca amplia o acesso.
    }
  }
  return origins;
}

function corsOrigin(request: Request, allowedOrigins: Set<string>): string | null | undefined {
  const origin = request.headers.get('Origin')?.replace(/\/$/, '');
  if (!origin) return undefined;
  if (origin === new URL(request.url).origin) return origin;
  return allowedOrigins.has(origin) ? origin : null;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  requestId: string,
  origin?: string
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseTokenHashes(value: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!value?.trim()) return result;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;
    for (const [analystId, hash] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        /^[a-z0-9][a-z0-9._-]{1,63}$/i.test(analystId) &&
        typeof hash === 'string' &&
        /^[a-f0-9]{64}$/i.test(hash)
      ) {
        result.set(hash.toLowerCase(), analystId);
      }
    }
  } catch {
    return result;
  }
  return result;
}

async function authorizedIdentity(
  request: Request,
  tokenHashes: Map<string, string>
): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  return tokenHashes.get(await sha256Hex(token)) ?? null;
}

async function authorizedAdmin(request: Request, expectedHash: string | undefined): Promise<boolean> {
  const normalizedHash = expectedHash?.trim().toLowerCase() ?? '';
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) return false;
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const token = authorization.slice(7).trim();
  return Boolean(token) && await sha256Hex(token) === normalizedHash;
}

function clientKey(request: Request): string {
  return request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
}

async function rateLimit(binding: RateLimitBinding | undefined, key: string): Promise<boolean> {
  if (!binding) return true;
  try {
    return (await binding.limit({ key })).success;
  } catch {
    return false;
  }
}

async function readJson(request: Request, limit: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new RequestValidationError(['corpo excede o limite permitido']);
  }
  const text = await request.text();
  if (!text) throw new RequestValidationError(['corpo JSON ausente']);
  if (new TextEncoder().encode(text).byteLength > limit) {
    throw new RequestValidationError(['corpo excede o limite permitido']);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestValidationError(['JSON inválido']);
  }
}

export function createWorkerApp(dependencies: WorkerDependencies = {}) {
  const logger = dependencies.logger ?? console;
  const now = dependencies.now ?? Date.now;
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const serviceCache = new WeakMap<object, AnalysisService>();
  const tokenHashCache = new WeakMap<object, Map<string, string>>();
  const originCache = new WeakMap<object, Set<string>>();
  // O ambiente do Worker é estável durante a vida da instância. Estes caches
  // evitam reconstruir serviços e reler secrets a cada chamada.
  const analysisService = (env: WorkerEnvironment): AnalysisService => {
    const cacheKey = env as object;
    const existing = serviceCache.get(cacheKey);
    if (existing) return existing;
    const created = dependencies.createAnalysisService?.(env) ?? createCloudAnalysisService(env);
    serviceCache.set(cacheKey, created);
    return created;
  };
  const tokenHashes = (env: WorkerEnvironment): Map<string, string> => {
    const cacheKey = env as object;
    const existing = tokenHashCache.get(cacheKey);
    if (existing) return existing;
    const created = parseTokenHashes(env.AEBOT_TOKEN_HASHES);
    tokenHashCache.set(cacheKey, created);
    return created;
  };
  const allowedOrigins = (env: WorkerEnvironment): Set<string> => {
    const cacheKey = env as object;
    const existing = originCache.get(cacheKey);
    if (existing) return existing;
    const created = normalizedAllowedOrigins(env.AEBOT_ALLOWED_ORIGINS);
    originCache.set(cacheKey, created);
    return created;
  };

  return {
    async fetch(
      request: Request,
      env: WorkerEnvironment,
      context?: WorkerExecutionContext
    ): Promise<Response> {
      const startedAt = now();
      const requestId = randomUUID();
      const requestUrl = new URL(request.url);
      const path = requestUrl.pathname;
      const allowedOrigin = corsOrigin(request, allowedOrigins(env));
      const finish = (statusCode: number, extra: Record<string, unknown> = {}) => {
        logger.info({
          requestId,
          method: request.method,
          path,
          statusCode,
          durationMs: now() - startedAt,
          ...extra,
        });
      };

      if (allowedOrigin === null) {
        const response = jsonResponse(403, { error: 'origin_not_allowed', requestId }, requestId);
        finish(403);
        return response;
      }
      const origin = allowedOrigin ?? undefined;

      if (request.method === 'OPTIONS') {
        const headers = new Headers({
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '600',
          'Cache-Control': 'no-store',
        });
        if (origin) headers.set('Access-Control-Allow-Origin', origin);
        finish(204);
        return new Response(null, { status: 204, headers });
      }

      const adminAsset = request.method === 'GET' ? adminAssetResponse(path) : null;
      if (adminAsset) {
        finish(200);
        return adminAsset;
      }

      const isPublicEndpoint = path === '/' || path === '/health';
      const adminFeedbackMatch = path.match(/^\/v1\/admin\/feedback\/([a-f0-9-]{36})$/i);
      const isAdminEndpoint =
        path === '/v1/admin/feedback' ||
        path === '/v1/admin/metrics' ||
        Boolean(adminFeedbackMatch);
      const adminAuthenticated = isAdminEndpoint
        ? await authorizedAdmin(request, env.AEBOT_ADMIN_TOKEN_HASH)
        : false;
      const analystId = isPublicEndpoint || isAdminEndpoint
        ? undefined
        : await authorizedIdentity(request, tokenHashes(env));
      if (!isPublicEndpoint && !analystId && !adminAuthenticated) {
        const permitted = await rateLimit(
          env.UNAUTHORIZED_RATE_LIMITER,
          `unauthorized:${clientKey(request)}`
        );
        const status = permitted ? 401 : 429;
        const error = permitted ? 'unauthorized' : 'rate_limit_exceeded';
        const response = jsonResponse(status, { error, requestId }, requestId, origin);
        finish(status);
        return response;
      }

      const authenticatedIdentity = adminAuthenticated ? 'admin' : analystId;
      const rateBinding = authenticatedIdentity
        ? env.ANALYST_RATE_LIMITER
        : env.PUBLIC_RATE_LIMITER;
      const rateKey = adminAuthenticated
        ? 'admin'
        : analystId
          ? `analyst:${analystId}`
          : `public:${clientKey(request)}`;
      if (!await rateLimit(rateBinding, rateKey)) {
        const response = jsonResponse(
          429,
          { error: 'rate_limit_exceeded', requestId },
          requestId,
          origin
        );
        finish(429, authenticatedIdentity ? { identity: authenticatedIdentity } : {});
        return response;
      }

      try {
        if (request.method === 'GET' && path === '/') {
          const response = jsonResponse(200, {
            status: 'ok',
            service: 'aebot-api',
            message: 'API online do AEBOT ativa.',
            health: '/health',
            requestId,
          }, requestId, origin);
          finish(200);
          return response;
        }

        if (request.method === 'GET' && path === '/health') {
          const service = analysisService(env);
          const status = service.status();
          const response = jsonResponse(200, {
            status: 'ok',
            service: 'aebot-api',
            runtime: 'cloudflare-worker',
            ruleStoreVersion: status.ruleStoreVersion,
            aiConfigured: status.aiConfigured,
            aiProvider: status.aiProvider,
            aiProviders: status.aiProviders,
            aiModels: status.aiModels,
            geminiConfigured: status.geminiConfigured,
            accessConfigured: tokenHashes(env).size > 0,
            feedbackConfigured: Boolean(env.FEEDBACK_DB),
            adminConfigured: /^[a-f0-9]{64}$/i.test(env.AEBOT_ADMIN_TOKEN_HASH?.trim() ?? ''),
            requestId,
          }, requestId, origin);
          finish(200);
          return response;
        }

        if (request.method === 'GET' && path === '/v1/services') {
          const service = analysisService(env);
          const status = service.status();
          const response = jsonResponse(200, {
            ruleStoreVersion: status.ruleStoreVersion,
            services: service.listServices(),
            requestId,
          }, requestId, origin);
          finish(200, { analystId });
          return response;
        }

        if (request.method === 'GET' && path === '/v1/status') {
          const service = analysisService(env);
          const response = jsonResponse(200, {
            status: 'ok',
            runtime: 'cloudflare-worker',
            ...service.status(),
            requestId,
          }, requestId, origin);
          finish(200, { analystId });
          return response;
        }

        if (request.method === 'POST' && path === '/v1/analyze') {
          const service = analysisService(env);
          if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
            throw new RequestValidationError(['Content-Type deve ser application/json']);
          }
          const input = parseAnalyzeRequest(await readJson(
            request,
            positiveInteger(env.AEBOT_BODY_LIMIT_BYTES, DEFAULT_BODY_LIMIT)
          ));
          const result = await service.analyze(input);
          const { modelAttempts, ...publicResult } = result;
          if (env.FEEDBACK_DB) {
            const metricWrite = recordAnalysisMetrics(env.FEEDBACK_DB, {
              analystId: analystId!,
              occurredAt: new Date(now()).toISOString(),
              durationMs: now() - startedAt,
              result,
            }).catch(() => logger.error({ requestId, path, errorType: 'metric_write_failed' }));
            context?.waitUntil(metricWrite);
            if (!context) await metricWrite;
          }
          const response = jsonResponse(200, { result: publicResult, requestId }, requestId, origin);
          finish(200, {
            analystId,
            outcome: result.evaluation.outcome,
            decision: result.decision,
            provider: result.provider,
          });
          return response;
        }

        if (request.method === 'POST' && path === '/v1/feedback') {
          if (!env.FEEDBACK_DB) {
            const response = jsonResponse(503, {
              error: 'feedback_unavailable',
              requestId,
            }, requestId, origin);
            finish(503, { analystId });
            return response;
          }
          if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
            throw new FeedbackValidationError(['Content-Type deve ser application/json']);
          }
          const input = parseFeedbackSubmission(await readJson(
            request,
            positiveInteger(env.AEBOT_BODY_LIMIT_BYTES, DEFAULT_BODY_LIMIT)
          ));
          const serviceExists = analysisService(env)
            .listServices()
            .some((service) => service.id === input.serviceId);
          if (!serviceExists) throw new FeedbackValidationError(['serviço não encontrado']);
          const feedbackId = randomUUID();
          await saveFeedback(env.FEEDBACK_DB, {
            ...input,
            id: feedbackId,
            analystId: analystId!,
            createdAt: new Date(now()).toISOString(),
          });
          await recordFeedbackMetrics(env.FEEDBACK_DB, {
            analystId: analystId!,
            occurredAt: new Date(now()).toISOString(),
          });
          const response = jsonResponse(201, {
            status: 'saved',
            feedbackId,
            requestId,
          }, requestId, origin);
          finish(201, { analystId, category: input.category, feedbackId });
          return response;
        }

        if (request.method === 'GET' && path === '/v1/admin/feedback') {
          if (!env.FEEDBACK_DB) {
            const response = jsonResponse(503, {
              error: 'feedback_unavailable',
              requestId,
            }, requestId, origin);
            finish(503, { identity: 'admin' });
            return response;
          }
          const rawCategory = requestUrl.searchParams.get('category');
          const category = parseFeedbackCategory(rawCategory);
          if (rawCategory && !category) {
            throw new FeedbackValidationError(['categoria de feedback inválida']);
          }
          const limit = Math.min(
            positiveInteger(requestUrl.searchParams.get('limit') ?? undefined, 50),
            100
          );
          const offset = Math.min(
            nonNegativeInteger(requestUrl.searchParams.get('offset'), 0),
            100_000
          );
          const feedback = await listFeedback(env.FEEDBACK_DB, { category, limit, offset });
          const response = jsonResponse(200, {
            feedback,
            nextOffset: feedback.length === limit ? offset + feedback.length : null,
            requestId,
          }, requestId, origin);
          finish(200, { identity: 'admin', feedbackCount: feedback.length });
          return response;
        }

        if (request.method === 'GET' && path === '/v1/admin/metrics') {
          if (!env.FEEDBACK_DB) {
            const response = jsonResponse(503, {
              error: 'metrics_unavailable',
              requestId,
            }, requestId, origin);
            finish(503, { identity: 'admin' });
            return response;
          }
          const days = Math.min(
            positiveInteger(requestUrl.searchParams.get('days') ?? undefined, 7),
            90
          );
          const endDay = new Date(now()).toISOString().slice(0, 10);
          const startDay = new Date(now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
          const metrics = await getOperationalMetrics(env.FEEDBACK_DB, { startDay, endDay, days });
          const response = jsonResponse(200, {
            metrics,
            quotas: quotaOverview(metrics),
            configuredModels: analysisService(env).status().aiModels ?? [],
            privacy: 'Nenhum texto de pergunta, resposta, histórico ou token de acesso é armazenado.',
            requestId,
          }, requestId, origin);
          finish(200, { identity: 'admin', metricDays: days });
          return response;
        }

        if (request.method === 'DELETE' && adminFeedbackMatch) {
          if (!env.FEEDBACK_DB) {
            const response = jsonResponse(503, {
              error: 'feedback_unavailable',
              requestId,
            }, requestId, origin);
            finish(503, { identity: 'admin' });
            return response;
          }
          const feedbackId = adminFeedbackMatch[1];
          await deleteFeedback(env.FEEDBACK_DB, feedbackId);
          const response = jsonResponse(200, {
            status: 'deleted',
            feedbackId,
            requestId,
          }, requestId, origin);
          finish(200, { identity: 'admin', feedbackId });
          return response;
        }

        const response = jsonResponse(404, { error: 'not_found', requestId }, requestId, origin);
        finish(404, analystId ? { analystId } : {});
        return response;
      } catch (error) {
        if (error instanceof RequestValidationError || error instanceof FeedbackValidationError) {
          const response = jsonResponse(400, {
            error: 'invalid_request',
            issues: error.issues,
            requestId,
          }, requestId, origin);
          finish(400, analystId ? { analystId } : adminAuthenticated ? { identity: 'admin' } : {});
          return response;
        }
        logger.error({ requestId, path, errorType: 'internal_error' });
        const response = jsonResponse(500, { error: 'internal_error', requestId }, requestId, origin);
        finish(500, analystId ? { analystId } : {});
        return response;
      }
    },
  };
}

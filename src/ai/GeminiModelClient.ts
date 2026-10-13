import { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } from '../localConfig';
import { getPackagedBackendUrl } from './BackendClient';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import type { StructuredModelClient, StructuredModelContent, StructuredModelRequestOptions, StructuredModelResult } from './StructuredModelClient';

const GEMINI_TIMEOUT_MS = 20_000;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

export interface BrowserGeminiConfiguration {
  getApiKey?: () => string;
  getModel?: () => string;
  getFallbackModel?: () => string;
}

/** Configuração do perfil Chrome legado. O desktop injeta seu cliente e não chama isto. */
export function getBrowserGeminiClient(configuration: BrowserGeminiConfiguration): StructuredModelClient | null {
  const apiKey = (!getPackagedBackendUrl() ? configuration.getApiKey?.() ??
    storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '') : '').trim();
  if (!apiKey) return null;
  return new GeminiModelClient(apiKey, normalizeGeminiModel(configuration.getModel?.() ??
    storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, GEMINI_MODEL)),
  normalizeGeminiModel(configuration.getFallbackModel?.() ?? GEMINI_FALLBACK_MODEL));
}

export function getGeminiThinkingConfig(
  model: string
): { thinkingLevel: 'LOW' } | { thinkingBudget: 0 } | undefined {
  if (
    model === 'gemini-flash-latest' ||
    model === 'gemini-flash-lite-latest' ||
    /^gemini-(?:[3-9]|[1-9]\d).*flash/i.test(model)
  ) {
    return { thinkingLevel: 'LOW' };
  }
  if (/^gemini-2\.5-flash(?:[-.]|$)/i.test(model)) {
    return { thinkingBudget: 0 };
  }
  return undefined;
}

function retryDelay(response?: Response): number {
  const seconds = Number(response?.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1_000, 2_000)
    : 500;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function requestGemini(
  apiKey: string,
  model: string,
  contents: StructuredModelContent[],
  systemInstruction: string,
  maxOutputTokens: number,
  options?: StructuredModelRequestOptions
): Promise<StructuredModelResult> {
  const startedAt = Date.now();
  const attempts = (
    status: StructuredModelResult['status'],
    usage: { inputTokens?: number; outputTokens?: number } = {}
  ) => [{
    provider: 'gemini' as const,
    model,
    status,
    durationMs: Date.now() - startedAt,
    ...usage,
  }];
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const thinkingConfig = getGeminiThinkingConfig(model);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                maxOutputTokens,
                responseMimeType: 'application/json',
                ...(options?.responseSchema
                  ? { responseSchema: options.responseSchema }
                  : {}),
                ...(!/^gemini-(?:3|[4-9]|[1-9]\d)/i.test(model)
                  ? { temperature: 0, topK: 8, topP: 0.8 }
                  : {}),
                ...(thinkingConfig ? { thinkingConfig } : {}),
              },
            }),
          }
        );
        if (!response.ok) {
          if (attempt === 0 && RETRYABLE_HTTP_STATUS.has(response.status)) {
            await wait(retryDelay(response));
            continue;
          }
          return {
            status: response.status === 429 ? 'rate_limited' : 'api_error',
            provider: 'gemini',
            attempts: attempts(response.status === 429 ? 'rate_limited' : 'api_error'),
          };
        }
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts)
          ? parts
              .filter((part) => part?.thought !== true && typeof part?.text === 'string')
              .map((part) => part.text)
              .join('')
          : undefined;
        const usage = data.usageMetadata ?? {};
        const token = (value: unknown): number | undefined =>
          Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
        const tokenUsage = {
          inputTokens: token(usage.promptTokenCount),
          outputTokens: token(usage.candidatesTokenCount),
        };
        return typeof text === 'string'
          ? { status: 'ok', provider: 'gemini', text, attempts: attempts('ok', tokenUsage) }
          : { status: 'api_error', provider: 'gemini', attempts: attempts('api_error', tokenUsage) };
      } catch {
        if (attempt === 0 && !controller.signal.aborted) {
          await wait(retryDelay());
          continue;
        }
        return { status: 'api_error', provider: 'gemini', attempts: attempts('api_error') };
      }
    }
    return { status: 'api_error', provider: 'gemini', attempts: attempts('api_error') };
  } catch {
    return { status: 'api_error', provider: 'gemini', attempts: attempts('api_error') };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function normalizeGeminiModel(value: string): string {
  const candidate = value.trim();
  return /^[a-z0-9][a-z0-9._-]{1,79}$/i.test(candidate) ? candidate : GEMINI_MODEL;
}

export class GeminiModelClient implements StructuredModelClient {
  readonly provider = 'gemini' as const;
  readonly providerChain = ['gemini'] as const;
  readonly modelChain: readonly string[];
  readonly cacheKey: string;

  constructor(
    private readonly apiKey: string,
    private readonly primaryModel: string,
    private readonly fallbackModel: string
  ) {
    this.cacheKey = `gemini:${primaryModel}:${fallbackModel}`;
    this.modelChain = [...new Set([primaryModel, fallbackModel])];
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number,
    options?: StructuredModelRequestOptions
  ): Promise<StructuredModelResult> {
    const primaryResponse = await requestGemini(
      this.apiKey,
      this.primaryModel,
      contents,
      systemInstruction,
      maxOutputTokens,
      options
    );
    const primaryIsValid =
      primaryResponse.status === 'ok' &&
      primaryResponse.text &&
      (!options?.validateText || options.validateText(primaryResponse.text));
    if (primaryIsValid || this.fallbackModel === this.primaryModel) {
      return primaryResponse;
    }
    const fallbackResponse = await requestGemini(
      this.apiKey,
      this.fallbackModel,
      contents,
      systemInstruction,
      maxOutputTokens,
      options
    );
    return {
      ...fallbackResponse,
      attempts: [
        ...(primaryResponse.attempts ?? []).map((attempt) =>
          primaryResponse.status === 'ok'
            ? { ...attempt, status: 'invalid_response' as const }
            : attempt
        ),
        ...(fallbackResponse.attempts ?? []),
      ],
    };
  }
}

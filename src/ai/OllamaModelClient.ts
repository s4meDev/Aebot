import type {
  StructuredModelClient,
  StructuredModelContent,
  StructuredModelResult,
} from './StructuredModelClient';

const OLLAMA_TIMEOUT_MS = 60_000;

export function normalizeOllamaBaseUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (
      url.protocol !== 'http:' ||
      !isLoopback ||
      url.username ||
      url.password ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeOllamaModel(value: string): string | null {
  const candidate = value.trim();
  return /^[a-z0-9][a-z0-9._:/-]{0,99}$/i.test(candidate) ? candidate : null;
}

export class OllamaModelClient implements StructuredModelClient {
  readonly provider = 'ollama' as const;
  readonly cacheKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl: string, model: string) {
    const normalizedUrl = normalizeOllamaBaseUrl(baseUrl);
    const normalizedModel = normalizeOllamaModel(model);
    if (!normalizedUrl || !normalizedModel) {
      throw new Error('Configuração do Ollama inválida. Use uma URL local e um modelo válido.');
    }
    this.baseUrl = normalizedUrl;
    this.model = normalizedModel;
    this.cacheKey = `ollama:${this.baseUrl}:${this.model}`;
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<StructuredModelResult> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          format: 'json',
          keep_alive: '30m',
          messages: [
            { role: 'system', content: systemInstruction },
            ...contents.map((content) => ({
              role: content.role === 'model' ? 'assistant' : 'user',
              content: content.parts.map((part) => part.text).join(''),
            })),
          ],
          options: {
            temperature: 0,
            num_predict: Math.max(64, Math.min(maxOutputTokens, 2_048)),
          },
        }),
      });
      if (!response.ok) return { status: 'api_error', provider: this.provider };
      const body = await response.json() as Record<string, unknown>;
      const message = body.message;
      const text = message && typeof message === 'object' && !Array.isArray(message)
        ? (message as Record<string, unknown>).content
        : undefined;
      return typeof text === 'string'
        ? { status: 'ok', provider: this.provider, text }
        : { status: 'api_error', provider: this.provider };
    } catch {
      return { status: 'api_error', provider: this.provider };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

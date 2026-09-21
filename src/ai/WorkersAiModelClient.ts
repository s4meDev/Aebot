import type {
  StructuredModelClient,
  StructuredModelContent,
  StructuredModelResult,
} from './StructuredModelClient';

export const DEFAULT_WORKERS_AI_MODEL = '@cf/openai/gpt-oss-20b';

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

function validModel(model: string): boolean {
  return /^@cf\/[a-z0-9][a-z0-9._/-]{2,120}$/i.test(model);
}

function extractResponseText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.response === 'string') return source.response;
  if (typeof source.result === 'string') return source.result;
  return undefined;
}

function extractUsage(value: unknown): { inputTokens?: number; outputTokens?: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const usage = (value as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return {};
  const source = usage as Record<string, unknown>;
  const integer = (candidate: unknown): number | undefined =>
    Number.isInteger(candidate) && Number(candidate) >= 0 ? Number(candidate) : undefined;
  return {
    inputTokens: integer(source.prompt_tokens ?? source.input_tokens),
    outputTokens: integer(source.completion_tokens ?? source.output_tokens),
  };
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const source = error as Record<string, unknown>;
  const status = source.status ?? source.statusCode ?? source.code;
  return status === 429 || String(status) === '429';
}

/** Cliente fino para o binding nativo do Workers AI. A decisão continua no RuleEngine. */
export class WorkersAiModelClient implements StructuredModelClient {
  readonly provider = 'workers-ai' as const;
  readonly providerChain = ['workers-ai'] as const;
  readonly modelChain: readonly string[];
  readonly cacheKey: string;
  readonly model: string;

  constructor(
    private readonly binding: WorkersAiBinding,
    model = DEFAULT_WORKERS_AI_MODEL
  ) {
    const candidate = model.trim();
    if (!validModel(candidate)) throw new Error('Modelo do Workers AI inválido.');
    this.model = candidate;
    this.modelChain = [candidate];
    this.cacheKey = `workers-ai:${candidate}`;
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<StructuredModelResult> {
    const messages = [
      { role: 'system', content: systemInstruction },
      ...contents.map((content) => ({
        role: content.role === 'model' ? 'assistant' : 'user',
        content: content.parts.map((part) => part.text).join(''),
      })),
    ];
    const startedAt = Date.now();
    try {
      const response = await this.binding.run(this.model, {
        messages,
        temperature: 0,
        max_tokens: Math.max(1, Math.min(maxOutputTokens, 2_048)),
      });
      const text = extractResponseText(response);
      const usage = extractUsage(response);
      const status = text ? 'ok' as const : 'api_error' as const;
      return text
        ? {
            status,
            provider: this.provider,
            text,
            attempts: [{
              provider: this.provider,
              model: this.model,
              status,
              durationMs: Date.now() - startedAt,
              ...usage,
            }],
          }
        : {
            status,
            provider: this.provider,
            attempts: [{
              provider: this.provider,
              model: this.model,
              status,
              durationMs: Date.now() - startedAt,
              ...usage,
            }],
          };
    } catch (error) {
      const status = isRateLimitError(error) ? 'rate_limited' as const : 'api_error' as const;
      return {
        status,
        provider: this.provider,
        attempts: [{
          provider: this.provider,
          model: this.model,
          status,
          durationMs: Date.now() - startedAt,
        }],
      };
    }
  }
}

import type { StructuredModelClient, StructuredModelContent, StructuredModelRequestOptions, StructuredModelResult } from '../src/ai/StructuredModelClient';

/** Só o processo principal fala com o runtime privado, sempre no loopback. */
export class LocalModelClient implements StructuredModelClient {
  readonly provider = 'local' as const;
  readonly providerChain = ['local'] as const;
  readonly modelChain = ['Qwen3-4B-Q4_K_M'] as const;
  readonly cacheKey = 'local:qwen3-4b-q4_k_m:v1';

  constructor(private readonly connection: () => { url: string; token: string } | null) {}

  async request(contents: StructuredModelContent[], systemInstruction: string, maxOutputTokens: number,
    options?: StructuredModelRequestOptions): Promise<StructuredModelResult> {
    const connection = this.connection();
    if (!connection) return { provider: 'local', status: 'api_error', attempts: [] };
    const url = new URL(connection.url);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
      throw new Error('O runtime local deve usar somente 127.0.0.1.');
    }
    const started = Date.now();
    let status: 'ok' | 'api_error' | 'rate_limited' = 'api_error';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let text: string | undefined;
    try {
      const response = await fetch(new URL('/v1/chat/completions', url), {
        method: 'POST', signal: AbortSignal.timeout(180_000), redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify({
          model: 'aebot-local', temperature: 0, stream: false,
          max_tokens: Math.min(maxOutputTokens, 1024),
          chat_template_kwargs: { enable_thinking: false },
          messages: [{ role: 'system', content: `${systemInstruction}\n/no_think` },
            ...contents.map((item) => ({ role: item.role === 'model' ? 'assistant' : 'user',
              content: item.parts.map((part) => part.text).join('') }))],
          response_format: options?.responseSchema
            ? { type: 'json_object', schema: options.responseSchema }
            : { type: 'json_object' },
        }),
      });
      if (response.status === 429 || response.status === 503) status = 'rate_limited';
      if (response.ok) {
        const body = await response.json() as {
          choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const choice = body.choices?.[0];
        const candidate = choice?.message?.content;
        if (typeof candidate === 'string' && candidate.length <= 32_768 && choice?.finish_reason !== 'length') {
          JSON.parse(candidate);
          if (!options?.validateText || options.validateText(candidate)) { text = candidate; status = 'ok'; }
        }
        const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
        inputTokens = count(body.usage?.prompt_tokens);
        outputTokens = count(body.usage?.completion_tokens);
      }
    } catch { /* O texto bruto e os erros do runtime podem conter o prompt: não registrar. */ }
    return { provider: 'local', status, text, attempts: [{ provider: 'local',
      model: this.modelChain[0], status, durationMs: Date.now() - started, inputTokens, outputTokens }] };
  }
}

import type { StructuredModelClient, StructuredModelContent, StructuredModelRequestOptions, StructuredModelResult } from '../src/ai/StructuredModelClient';

/** Só o processo principal fala com o runtime privado, sempre no loopback. */
export class LocalModelClient implements StructuredModelClient {
  readonly provider = 'local' as const;
  readonly providerChain = ['local'] as const;
  readonly modelChain = ['Qwen3-4B-Q4_K_M'] as const;
  get cacheKey() { return `local:qwen3-4b-q4_k_m:v3:${this.options.thinking ? 'thinking-512' : 'direct'}`; }

  constructor(private readonly connection: () => { url: string; token: string } | null,
    private readonly options: { thinking?: boolean } = {}) {}

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
    let invalidResponse = false;
    try {
      const response = await fetch(new URL('/v1/chat/completions', url), {
        method: 'POST', signal: AbortSignal.timeout(180_000), redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify({
          // Perfis oficiais do Qwen. O modo com raciocínio tem orçamento no runtime.
          // Seed fixa facilita comparar rodadas, sem garantir igualdade entre máquinas.
          model: 'aebot-local', temperature: this.options.thinking ? 0.6 : 0.7,
          top_p: this.options.thinking ? 0.95 : 0.8, top_k: 20, min_p: 0, seed: 42, stream: false,
          max_tokens: Math.min(maxOutputTokens, this.options.thinking ? 2048 : 1024),
          chat_template_kwargs: { enable_thinking: this.options.thinking === true },
          messages: [{ role: 'system', content: `${systemInstruction}\n${this.options.thinking ? '/think' : '/no_think'}` },
            ...contents.map((item) => ({ role: item.role === 'model' ? 'assistant' : 'user',
              content: item.parts.map((part) => part.text).join('') }))],
          response_format: options?.responseSchema
            ? { type: 'json_object', schema: options.responseSchema }
            : { type: 'json_object' },
        }),
      });
      if (response.status === 429 || response.status === 503) status = 'rate_limited';
      if (response.ok) {
        invalidResponse = true;
        const body = await response.json() as {
          choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const choice = body.choices?.[0];
        const candidate = choice?.message?.content;
        if (typeof candidate === 'string' && candidate.length <= 32_768 && choice?.finish_reason !== 'length') {
          JSON.parse(candidate);
          if (!options?.validateText || options.validateText(candidate)) {
            text = candidate; status = 'ok'; invalidResponse = false;
          }
        }
        const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
        inputTokens = count(body.usage?.prompt_tokens);
        outputTokens = count(body.usage?.completion_tokens);
      }
    } catch { /* O texto bruto e os erros do runtime podem conter o prompt: não registrar. */ }
    return { provider: 'local', status, text, attempts: [{ provider: 'local',
      model: this.modelChain[0], status: invalidResponse ? 'invalid_response' : status,
      durationMs: Date.now() - started, inputTokens, outputTokens }] };
  }
}

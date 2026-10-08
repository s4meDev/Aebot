import type { StructuredModelClient, StructuredModelContent, StructuredModelRequestOptions, StructuredModelResult } from '../src/ai/StructuredModelClient';
import assetsLock from '../desktop-resources/assets-lock.json';

/** Só números do runtime. Não transporta relato, resposta ou raciocínio. */
export interface LocalInferenceTimings {
  cachedTokens?: number;
  processedTokens?: number;
  promptMs?: number;
  generatedTokens?: number;
  generationMs?: number;
}

/** Só o processo principal fala com o runtime privado, sempre no loopback. */
export class LocalModelClient implements StructuredModelClient {
  readonly provider = 'local' as const;
  readonly providerChain = ['local'] as const;
  get modelChain() { return [this.options.modelName ?? assetsLock.model.name.replace(/\.gguf$/, '')]; }
  get localInterpretationProtocol() { return this.options.indexed !== false ? 'indexed' as const : 'compact' as const; }
  get cacheKey() { return `local:${this.modelChain[0]}:${this.options.modelSha256 ?? assetsLock.model.sha256}:v31:${this.localInterpretationProtocol}-prefix:kv-q8:auto-context:no-warmup:${this.options.thinking ? 'thinking-' + (this.options.reasoningBudget ?? 512) : 'direct'}:temperature-${this.options.temperature ?? (this.options.thinking ? 0.6 : 0.7)}`; }

  constructor(private readonly connection: () => { url: string; token: string } | null,
    private readonly options: { thinking?: boolean; reasoningBudget?: number; modelName?: string; modelSha256?: string; temperature?: number;
      indexed?: boolean; onTimings?: (timings: LocalInferenceTimings) => void;
      prepareSystemPrefix?: (instruction: string) => Promise<unknown> } = {}) {
    if (options.temperature !== undefined && (!Number.isFinite(options.temperature) || options.temperature < 0 || options.temperature > 1)) {
      throw new Error('Temperatura experimental inválida.');
    }
  }

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
      const instruction = `${systemInstruction}\n${this.options.thinking ? '/think' : '/no_think'}`;
      // Só restaura recursos públicos do pacote. A análise não pode salvar seu
      // prompt ou o slot em disco. Se não houver recurso compatível, segue fria.
      await this.options.prepareSystemPrefix?.(instruction);
      const response = await fetch(new URL('/v1/chat/completions', url), {
        method: 'POST', signal: AbortSignal.timeout(180_000), redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify({
          // Perfis oficiais do Qwen. O modo com raciocínio tem orçamento no runtime.
          // Seed fixa facilita comparar rodadas, sem garantir igualdade entre máquinas.
          model: 'aebot-local', temperature: this.options.temperature ?? (this.options.thinking ? 0.6 : 0.7),
          top_p: this.options.thinking ? 0.95 : 0.8, top_k: 20, min_p: 0, seed: 42, stream: false, cache_prompt: true,
          // Conserva IDs reais, mas não pede citações livres nem uma explicação
          // duplicada. Saída truncada continua sendo recusada.
          max_tokens: Math.min(maxOutputTokens, this.options.thinking ? 2048 : this.localInterpretationProtocol === 'indexed' ? 384 : 1024),
          chat_template_kwargs: { enable_thinking: this.options.thinking === true },
          messages: [{ role: 'system', content: instruction },
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
          timings?: Record<string, unknown>;
        };
        // A geração consumiu recursos mesmo se o JSON produzido não puder ser usado.
        const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
        inputTokens = count(body.usage?.prompt_tokens);
        outputTokens = count(body.usage?.completion_tokens);
        const duration = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
        // O avaliador observa desempenho sem precisar salvar o JSON bruto.
        if (body.timings && this.options.onTimings) {
          const timings = { cachedTokens: count(body.timings.cache_n), processedTokens: count(body.timings.prompt_n),
            promptMs: duration(body.timings.prompt_ms), generatedTokens: count(body.timings.predicted_n),
            generationMs: duration(body.timings.predicted_ms) };
          try { this.options.onTimings(timings); } catch { /* Diagnóstico não altera a análise. */ }
        }
        const choice = body.choices?.[0];
        const candidate = choice?.message?.content;
        if (typeof candidate === 'string' && candidate.length <= 32_768 && choice?.finish_reason !== 'length') {
          JSON.parse(candidate);
          if (!options?.validateText || options.validateText(candidate)) {
            text = candidate; status = 'ok'; invalidResponse = false;
          }
        }
      }
    } catch { /* O texto bruto e os erros do runtime podem conter o prompt: não registrar. */ }
    return { provider: 'local', status, text, attempts: [{ provider: 'local',
      model: this.modelChain[0], status: invalidResponse ? 'invalid_response' : status,
      durationMs: Date.now() - started, inputTokens, outputTokens }] };
  }
}

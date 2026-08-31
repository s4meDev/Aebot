export type StructuredModelProvider = 'gemini' | 'workers-ai';

export interface StructuredModelContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface StructuredModelResult {
  status: 'ok' | 'api_error' | 'rate_limited';
  provider: StructuredModelProvider;
  text?: string;
}

export interface StructuredModelRequestOptions {
  /** Schema JSON usado pelos provedores que oferecem saída estruturada nativa. */
  responseSchema?: Record<string, unknown>;
}

/** Transporte de modelo que apenas produz JSON; nunca calcula a decisão da OS. */
export interface StructuredModelClient {
  readonly provider: StructuredModelProvider;
  /** Ordem real dos provedores que podem atender esta chamada. */
  readonly providerChain: readonly StructuredModelProvider[];
  /** Identidade segura para separar caches de modelos/configurações diferentes. */
  readonly cacheKey: string;
  request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number,
    options?: StructuredModelRequestOptions
  ): Promise<StructuredModelResult>;
}

/** Usa o próximo provedor online somente diante de falha técnica ou limite de cota. */
export class FallbackStructuredModelClient implements StructuredModelClient {
  readonly provider: StructuredModelProvider;
  readonly providerChain: readonly StructuredModelProvider[];
  readonly cacheKey: string;

  constructor(
    private readonly primary: StructuredModelClient,
    private readonly fallback: StructuredModelClient
  ) {
    this.provider = primary.provider;
    this.providerChain = [...primary.providerChain, ...fallback.providerChain]
      .filter((provider, index, providers) => providers.indexOf(provider) === index);
    this.cacheKey = `${primary.cacheKey}|fallback:${fallback.cacheKey}`;
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number,
    options?: StructuredModelRequestOptions
  ): Promise<StructuredModelResult> {
    const primaryResult = await this.primary.request(
      contents,
      systemInstruction,
      maxOutputTokens,
      options
    );
    if (primaryResult.status === 'ok') return primaryResult;
    return this.fallback.request(contents, systemInstruction, maxOutputTokens, options);
  }
}

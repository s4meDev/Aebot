export type StructuredModelProvider = 'gemini' | 'ollama' | 'workers-ai';

export interface StructuredModelContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface StructuredModelResult {
  status: 'ok' | 'api_error' | 'rate_limited';
  provider: StructuredModelProvider;
  text?: string;
}

/** Transporte de modelo que apenas produz JSON; nunca calcula a decisão da OS. */
export interface StructuredModelClient {
  readonly provider: StructuredModelProvider;
  /** Identidade segura para separar caches de modelos/configurações diferentes. */
  readonly cacheKey: string;
  request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<StructuredModelResult>;
}

/** Tenta o modelo local primeiro e usa o externo somente diante de falha técnica. */
export class FallbackStructuredModelClient implements StructuredModelClient {
  readonly provider: StructuredModelProvider;
  readonly cacheKey: string;

  constructor(
    private readonly primary: StructuredModelClient,
    private readonly fallback: StructuredModelClient
  ) {
    this.provider = primary.provider;
    this.cacheKey = `${primary.cacheKey}|fallback:${fallback.cacheKey}`;
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<StructuredModelResult> {
    const primaryResult = await this.primary.request(
      contents,
      systemInstruction,
      maxOutputTokens
    );
    if (primaryResult.status === 'ok') return primaryResult;
    return this.fallback.request(contents, systemInstruction, maxOutputTokens);
  }
}

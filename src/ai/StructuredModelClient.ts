import type { AiModelAttempt } from '../types';

export type StructuredModelProvider = 'gemini' | 'workers-ai' | 'local';

export interface StructuredModelContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface StructuredModelResult {
  status: 'ok' | 'api_error' | 'rate_limited';
  provider: StructuredModelProvider;
  text?: string;
  attempts?: AiModelAttempt[];
}

export interface StructuredModelRequestOptions {
  /** Schema JSON usado pelos provedores que oferecem saída estruturada nativa. */
  responseSchema?: Record<string, unknown>;
  /**
   * Permite rejeitar JSON semanticamente inválido antes de encerrar a cadeia.
   * Assim, uma resposta HTTP válida mas fora do contrato tenta o próximo modelo.
   */
  validateText?: (text: string) => boolean;
}

/** Transporte de modelo que apenas produz JSON; nunca calcula a decisão da OS. */
export interface StructuredModelClient {
  readonly provider: StructuredModelProvider;
  /** Ordem real dos provedores que podem atender esta chamada. */
  readonly providerChain: readonly StructuredModelProvider[];
  /** Modelos concretos, na ordem em que podem ser tentados. */
  readonly modelChain?: readonly string[];
  /** Identidade segura para separar caches de modelos/configurações diferentes. */
  readonly cacheKey: string;
  request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number,
    options?: StructuredModelRequestOptions
  ): Promise<StructuredModelResult>;
}

function attemptsWithValidationStatus(
  result: StructuredModelResult,
  options?: StructuredModelRequestOptions
): AiModelAttempt[] {
  const attempts = result.attempts ?? [];
  const invalid =
    result.status === 'ok' &&
    Boolean(result.text) &&
    Boolean(options?.validateText) &&
    !options!.validateText!(result.text!);
  if (!invalid || !attempts.length) return attempts;
  return attempts.map((attempt, index) =>
    index === attempts.length - 1 ? { ...attempt, status: 'invalid_response' } : attempt
  );
}

/** Usa o próximo provedor online somente diante de falha técnica ou limite de cota. */
export class FallbackStructuredModelClient implements StructuredModelClient {
  readonly provider: StructuredModelProvider;
  readonly providerChain: readonly StructuredModelProvider[];
  readonly modelChain: readonly string[];
  readonly cacheKey: string;

  constructor(
    private readonly primary: StructuredModelClient,
    private readonly fallback: StructuredModelClient
  ) {
    this.provider = primary.provider;
    this.providerChain = [...primary.providerChain, ...fallback.providerChain]
      .filter((provider, index, providers) => providers.indexOf(provider) === index);
    this.modelChain = [...(primary.modelChain ?? []), ...(fallback.modelChain ?? [])]
      .filter((model, index, models) => models.indexOf(model) === index);
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
    if (
      primaryResult.status === 'ok' &&
      primaryResult.text &&
      (!options?.validateText || options.validateText(primaryResult.text))
    ) {
      return primaryResult;
    }
    const fallbackResult = await this.fallback.request(
      contents,
      systemInstruction,
      maxOutputTokens,
      options
    );
    return {
      ...fallbackResult,
      attempts: [
        ...attemptsWithValidationStatus(primaryResult, options),
        ...(fallbackResult.attempts ?? []),
      ],
    };
  }
}

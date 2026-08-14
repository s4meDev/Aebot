import type {
  AiMessage,
  AiProvider,
  AiProviderResponse,
  DataRule,
  DataService,
  DecisionType,
  RuleEvaluationResult,
  SemanticRuleMapping,
  ServiceIdentity,
} from '../types';
import { getPackagedBackendUrl } from './BackendClient';
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL } from '../localConfig';
import { ruleEngine, type RuleEngine } from '../services/RuleEngine';
import {
  formatEvaluationResponse,
  type ResponseNarrative,
} from '../services/ResponseFormatter';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  buildEvaluationPrompt,
  buildSemanticInterpretationPrompt,
} from './PromptBuilder';
import { resolveContextualQuery } from '../services/ConversationContextResolver';
import {
  parseSemanticInterpretation,
  type SemanticInterpretation,
} from '../services/SemanticInterpreter';
import { selectSemanticRuleCandidates } from '../services/SemanticRuleRetriever';
import type {
  StructuredModelClient,
  StructuredModelContent,
  StructuredModelProvider,
  StructuredModelResult,
} from './StructuredModelClient';

const GEMINI_TIMEOUT_MS = 20_000;
const SEMANTIC_CACHE_LIMIT = 1_000;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

export function getGeminiThinkingConfig(
  model: string
): { thinkingLevel: 'MINIMAL' } | { thinkingBudget: 0 } | undefined {
  if (
    model === 'gemini-flash-latest' ||
    model === 'gemini-flash-lite-latest' ||
    /^gemini-(?:[3-9]|[1-9]\d).*flash/i.test(model)
  ) {
    return { thinkingLevel: 'MINIMAL' };
  }
  if (/^gemini-2\.5-flash(?:[-.]|$)/i.test(model)) {
    return { thinkingBudget: 0 };
  }
  return undefined;
}

export interface GeminiProviderConfiguration {
  getApiKey?: () => string;
  getModel?: () => string;
  getFallbackModel?: () => string;
  /** Permite ao backend usar um modelo local sem alterar o motor determinístico. */
  getModelClient?: () => StructuredModelClient | null;
  humanizeDeterministicResponses?: boolean;
}

interface SemanticAttempt {
  interpretation?: SemanticInterpretation;
  provider: StructuredModelProvider;
  fallbackReason?: AiProviderResponse['fallbackReason'];
}

async function buildPrivateCacheKey(parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join('|'));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
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
  maxOutputTokens: number
): Promise<StructuredModelResult> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const thinkingConfig = getGeminiThinkingConfig(model);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: {
                temperature: 0,
                topK: 8,
                topP: 0.8,
                maxOutputTokens,
                responseMimeType: 'application/json',
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
        return typeof text === 'string'
          ? { status: 'ok', provider: 'gemini', text }
          : { status: 'api_error', provider: 'gemini' };
      } catch (error) {
        if (attempt === 0 && !controller.signal.aborted) {
          await wait(retryDelay());
          continue;
        }
        console.warn('Erro ao chamar API do Gemini:', error);
        return { status: 'api_error', provider: 'gemini' };
      }
    }
    return { status: 'api_error', provider: 'gemini' };
  } catch (error) {
    console.warn('Erro ao chamar API do Gemini:', error);
    return { status: 'api_error', provider: 'gemini' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function normalizeGeminiModel(value: string): string {
  const candidate = value.trim();
  if (candidate === 'gemini-2.5-flash') return GEMINI_MODEL;
  return /^[a-z0-9][a-z0-9._-]{1,79}$/i.test(candidate) ? candidate : GEMINI_MODEL;
}

export class GeminiModelClient implements StructuredModelClient {
  readonly provider = 'gemini' as const;
  readonly cacheKey: string;

  constructor(
    private readonly apiKey: string,
    private readonly primaryModel: string,
    private readonly fallbackModel: string
  ) {
    this.cacheKey = `gemini:${primaryModel}:${fallbackModel}`;
  }

  async request(
    contents: StructuredModelContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<StructuredModelResult> {
    const primaryResponse = await requestGemini(
      this.apiKey,
      this.primaryModel,
      contents,
      systemInstruction,
      maxOutputTokens
    );
    if (primaryResponse.status !== 'rate_limited' || this.fallbackModel === this.primaryModel) {
      return primaryResponse;
    }
    return requestGemini(
      this.apiKey,
      this.fallbackModel,
      contents,
      systemInstruction,
      maxOutputTokens
    );
  }
}

export function buildGeminiContents(
  history: AiMessage[],
  currentPrompt: string,
  augmentedPrompt: string
): StructuredModelContent[] {
  const relevantHistory = history.filter((message) => message.id !== 'welcome');
  const lastMessage = relevantHistory[relevantHistory.length - 1];
  const historyWithoutCurrent =
    lastMessage?.role === 'user' && lastMessage.content.trim() === currentPrompt.trim()
      ? relevantHistory.slice(0, -1)
      : relevantHistory;

  const formattedHistory: StructuredModelContent[] = historyWithoutCurrent.slice(-6).map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.content }],
  }));

  return [...formattedHistory, { role: 'user', parts: [{ text: augmentedPrompt }] }];
}

function mentionsDecision(text: string): DecisionType[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return [
    normalized.includes('nao conforme') ? 'Não Conforme' : null,
    normalized.includes('reprovado') ? 'Reprovado' : null,
    /(^|\s)conforme($|\s)/.test(normalized.replace(/nao conforme/g, '')) ? 'Conforme' : null,
  ].filter((decision): decision is DecisionType => decision !== null);
}

function parseNarrative(text: string, evaluation: RuleEvaluationResult): ResponseNarrative | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    if (typeof parsed.justification !== 'string' || typeof parsed.guidance !== 'string') return null;
    if (parsed.justification.length > 500 || parsed.guidance.length > 300) return null;

    const combined = `${parsed.justification} ${parsed.guidance}`;
    const decisions = mentionsDecision(combined);
    const allowedDecisions = evaluation.outcome === 'informational'
      ? new Set(evaluation.matchedRules.flatMap((rule) => rule.severity ? [rule.severity] : []))
      : new Set(evaluation.decision ? [evaluation.decision] : []);
    if (decisions.some((decision) => !allowedDecisions.has(decision))) return null;

    const mentionedRuleIds = combined.match(/RULE-[A-Z0-9-]+/gi) ?? [];
    const knownRuleIds = new Set(evaluation.matchedRules.map((rule) => rule.id.toUpperCase()));
    if (mentionedRuleIds.some((id) => !knownRuleIds.has(id.toUpperCase()))) return null;

    return { justification: parsed.justification.trim(), guidance: parsed.guidance.trim() };
  } catch {
    return null;
  }
}

function applyConversationContext(
  baseEvaluation: RuleEvaluationResult,
  contextualQuery: ReturnType<typeof resolveContextualQuery>
): RuleEvaluationResult {
  if (!contextualQuery.contextApplied) return baseEvaluation;

  const isCorrectionWithoutDecision =
    contextualQuery.mode === 'correction' &&
    baseEvaluation.outcome === 'insufficient' &&
    !baseEvaluation.errorCode;
  return {
    ...baseEvaluation,
    contextApplied: true,
    outcome: isCorrectionWithoutDecision ? 'informational' : baseEvaluation.outcome,
    confidence: isCorrectionWithoutDecision ? 'baixa' : baseEvaluation.confidence,
    insufficiencyReason: isCorrectionWithoutDecision
      ? undefined
      : baseEvaluation.insufficiencyReason,
    requiresHumanValidation: isCorrectionWithoutDecision
      ? false
      : baseEvaluation.requiresHumanValidation,
    reasoningSummary: isCorrectionWithoutDecision
      ? 'A correção mais recente foi considerada e substituiu o fato anterior relacionado. Ainda faltam informações para recomendar uma conclusão oficial.'
      : contextualQuery.mode === 'correction'
        ? `Considerei a correção mais recente. ${baseEvaluation.reasoningSummary}`
        : `Considerei também a pergunta anterior. ${baseEvaluation.reasoningSummary}`,
  };
}

function applySemanticMetadata(
  evaluation: RuleEvaluationResult,
  originalNormalizedQuery: string,
  mappings: SemanticRuleMapping[]
): RuleEvaluationResult {
  const semanticReason = mappings.length
    ? 'A linguagem livre foi associada a conceitos cadastrados.'
    : 'A interpretação semântica também não encontrou correspondência segura no catálogo.';
  return {
    ...evaluation,
    normalizedQuery: originalNormalizedQuery,
    confidence: evaluation.confidence === 'alta' ? 'média' : evaluation.confidence,
    semanticInterpretationApplied: true,
    semanticMappings: mappings,
    reasoningSummary: `${semanticReason} ${evaluation.reasoningSummary}`,
  };
}

function hasGroundedRuleMatch(evaluation: RuleEvaluationResult): boolean {
  return evaluation.matchedRules.some((rule) =>
    rule.matchReasons.some((reason) => reason !== 'tema da regra identificado')
  );
}

export class GeminiProvider implements AiProvider {
  private readonly semanticCache = new Map<string, {
    interpretation: SemanticInterpretation;
    provider: StructuredModelProvider;
  }>();
  private readonly semanticInFlight = new Map<string, Promise<SemanticAttempt>>();
  private readonly metrics = {
    semanticCacheHits: 0,
    semanticCacheMisses: 0,
    coalescedRequests: 0,
    modelRequests: 0,
  };

  constructor(
    private readonly engine: RuleEngine = ruleEngine,
    private readonly configuration: GeminiProviderConfiguration = {}
  ) {}

  private getCachedInterpretation(key: string): {
    interpretation: SemanticInterpretation;
    provider: StructuredModelProvider;
  } | undefined {
    const cached = this.semanticCache.get(key);
    if (!cached) {
      this.metrics.semanticCacheMisses += 1;
      return undefined;
    }
    this.metrics.semanticCacheHits += 1;
    this.semanticCache.delete(key);
    this.semanticCache.set(key, cached);
    return cached;
  }

  private cacheInterpretation(
    key: string,
    interpretation: SemanticInterpretation,
    provider: StructuredModelProvider
  ): void {
    this.semanticCache.set(key, { interpretation, provider });
    if (this.semanticCache.size <= SEMANTIC_CACHE_LIMIT) return;
    const oldestKey = this.semanticCache.keys().next().value;
    if (typeof oldestKey === 'string') this.semanticCache.delete(oldestKey);
  }

  private requestSemanticInterpretation(
    cacheKey: string,
    query: string,
    service: DataService,
    rules: DataRule[],
    modelClient: StructuredModelClient
  ): Promise<SemanticAttempt> {
    const pending = this.semanticInFlight.get(cacheKey);
    if (pending) {
      this.metrics.coalescedRequests += 1;
      return pending;
    }

    const request = (async (): Promise<SemanticAttempt> => {
      const selection = selectSemanticRuleCandidates(query, rules);
      const semanticPrompt = buildSemanticInterpretationPrompt(query, service, selection.rules);
      this.metrics.modelRequests += 1;
      const response = await modelClient.request(
        [{ role: 'user', parts: [{ text: semanticPrompt }] }],
        'Extraia somente mapeamentos semânticos aterrados no catálogo fornecido. Nunca decida a conclusão da análise.',
        1024
      );
      if (response.status !== 'ok' || !response.text) {
        return {
          provider: response.provider,
          fallbackReason: response.status === 'rate_limited' ? 'rate_limited' : 'api_error',
        };
      }
      const interpretation = parseSemanticInterpretation(
        response.text,
        query,
        selection.rules
      ) ?? undefined;
      return {
        interpretation,
        provider: response.provider,
        fallbackReason: interpretation ? undefined : 'invalid_response',
      };
    })().finally(() => {
      this.semanticInFlight.delete(cacheKey);
    });
    this.semanticInFlight.set(cacheKey, request);
    return request;
  }

  async generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history: AiMessage[] = []
  ): Promise<AiProviderResponse> {
    // O contexto da conversa é resolvido antes do motor para que toda decisão
    // continue determinística, inclusive quando a pergunta completa usa duas mensagens.
    const contextualQuery = resolveContextualQuery(prompt, history);
    const rawBaseEvaluation = this.engine.evaluatePrompt(contextualQuery.query, service.id);
    let evaluation = applyConversationContext(rawBaseEvaluation, contextualQuery);
    const directGeminiAllowed = !getPackagedBackendUrl();
    const customKey = directGeminiAllowed
      ? this.configuration.getApiKey?.()
        ?? storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '')
      : '';
    const apiKey = customKey.trim();
    const selectedModel = normalizeGeminiModel(
      this.configuration.getModel?.()
        ?? storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, GEMINI_MODEL)
    );
    const selectedFallbackModel = normalizeGeminiModel(
      this.configuration.getFallbackModel?.() ?? GEMINI_FALLBACK_MODEL
    );
    const configuredModelClient = this.configuration.getModelClient?.();
    const modelClient = this.configuration.getModelClient
      ? configuredModelClient
      : apiKey
        ? new GeminiModelClient(apiKey, selectedModel, selectedFallbackModel)
        : null;
    let fallbackReason: AiProviderResponse['fallbackReason'] = modelClient
      ? undefined
      : 'no_api_key';

    // A IA só entra para ligar uma frase desconhecida às expressões cadastradas
    // ou para deixar a explicação mais natural. Ela nunca troca a decisão.
    if (modelClient) {
      if (
        rawBaseEvaluation.outcome === 'insufficient' &&
        !rawBaseEvaluation.errorCode &&
        !hasGroundedRuleMatch(rawBaseEvaluation)
      ) {
        const serviceRecord = this.engine.getServices().find((item) => item.id === service.id);
        const serviceRules = this.engine.getRulesForService(service.id);
        if (serviceRecord) {
          const cacheKey = await buildPrivateCacheKey([
            service.id,
            rawBaseEvaluation.ruleStoreVersion,
            modelClient.cacheKey,
            rawBaseEvaluation.normalizedQuery,
          ]);
          const cachedInterpretation = this.getCachedInterpretation(cacheKey);
          let interpretation = cachedInterpretation?.interpretation;
          let semanticProvider = cachedInterpretation?.provider ?? modelClient.provider;

          if (!interpretation) {
            const semanticAttempt = await this.requestSemanticInterpretation(
              cacheKey,
              contextualQuery.query,
              serviceRecord,
              serviceRules,
              modelClient
            );
            interpretation = semanticAttempt.interpretation;
            semanticProvider = semanticAttempt.provider;
            fallbackReason = semanticAttempt.fallbackReason;
            if (interpretation) {
              this.cacheInterpretation(cacheKey, interpretation, semanticProvider);
            }
          }

          if (interpretation) {
            const semanticBase = interpretation.canonicalPrompt
              ? this.engine.evaluatePrompt(interpretation.canonicalPrompt, service.id)
              : rawBaseEvaluation;
            if (semanticBase.outcome !== 'insufficient' || !interpretation.canonicalPrompt) {
              evaluation = applySemanticMetadata(
                applyConversationContext(semanticBase, contextualQuery),
                rawBaseEvaluation.normalizedQuery,
                interpretation.mappings
              );
              return {
                provider: semanticProvider,
                content: formatEvaluationResponse(evaluation),
                decision: evaluation.decision,
                evaluation,
              };
            }
            fallbackReason = 'invalid_response';
          }
        }
      } else if (
        !rawBaseEvaluation.errorCode &&
        this.configuration.humanizeDeterministicResponses !== false
      ) {
        const augmentedPrompt = buildEvaluationPrompt(prompt, evaluation);
        this.metrics.modelRequests += 1;
        const narrativeResponse = await modelClient.request(
          buildGeminiContents(history, prompt, augmentedPrompt),
          context,
          1024
        );
        if (narrativeResponse.status === 'ok') {
          const narrative = narrativeResponse.text
            ? parseNarrative(narrativeResponse.text, evaluation)
            : null;
          if (narrative) {
            return {
              provider: narrativeResponse.provider,
              content: formatEvaluationResponse(evaluation, narrative),
              decision: evaluation.decision,
              evaluation,
            };
          }
          fallbackReason = 'invalid_response';
        } else {
          fallbackReason = narrativeResponse.status === 'rate_limited'
            ? 'rate_limited'
            : 'api_error';
        }
      }
    }

    if (
      modelClient &&
      rawBaseEvaluation.outcome === 'insufficient' &&
      !hasGroundedRuleMatch(rawBaseEvaluation) &&
      !rawBaseEvaluation.errorCode &&
      !evaluation.semanticInterpretationApplied
    ) {
      evaluation = {
        ...evaluation,
        insufficiencyReason: 'semantic_unavailable',
        reasoningSummary: fallbackReason === 'rate_limited'
          ? 'O matching local não encontrou correspondência suficiente e o limite temporário do provedor de IA foi atingido.'
          : 'O matching local não encontrou correspondência suficiente e a interpretação semântica não pôde ser concluída ou validada.',
        requiresHumanValidation: true,
      };
    }

    return {
      provider: 'simulated',
      content: formatEvaluationResponse(evaluation),
      decision: evaluation.decision,
      evaluation,
      fallbackReason,
    };
  }

  getDiagnostics(): {
    semanticCacheEntries: number;
    semanticCacheHits: number;
    semanticCacheMisses: number;
    coalescedRequests: number;
    modelRequests: number;
  } {
    return {
      semanticCacheEntries: this.semanticCache.size,
      ...this.metrics,
    };
  }
}

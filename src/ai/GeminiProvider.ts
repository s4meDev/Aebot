import type {
  AiMessage,
  AiProvider,
  AiProviderResponse,
  DecisionType,
  RuleEvaluationResult,
  SemanticRuleMapping,
  ServiceIdentity,
} from '../types';
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

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

const GEMINI_TIMEOUT_MS = 20_000;
const SEMANTIC_CACHE_LIMIT = 100;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

interface GeminiRequestResult {
  status: 'ok' | 'api_error' | 'rate_limited';
  text?: string;
}

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
  humanizeDeterministicResponses?: boolean;
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
  contents: GeminiContent[],
  systemInstruction: string,
  maxOutputTokens: number
): Promise<GeminiRequestResult> {
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
          return { status: response.status === 429 ? 'rate_limited' : 'api_error' };
        }
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts)
          ? parts
              .filter((part) => part?.thought !== true && typeof part?.text === 'string')
              .map((part) => part.text)
              .join('')
          : undefined;
        return typeof text === 'string' ? { status: 'ok', text } : { status: 'ok' };
      } catch (error) {
        if (attempt === 0 && !controller.signal.aborted) {
          await wait(retryDelay());
          continue;
        }
        console.warn('Erro ao chamar API do Gemini:', error);
        return { status: 'api_error' };
      }
    }
    return { status: 'api_error' };
  } catch (error) {
    console.warn('Erro ao chamar API do Gemini:', error);
    return { status: 'api_error' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function normalizeGeminiModel(value: string): string {
  const candidate = value.trim();
  if (candidate === 'gemini-2.5-flash') return GEMINI_MODEL;
  return /^[a-z0-9][a-z0-9._-]{1,79}$/i.test(candidate) ? candidate : GEMINI_MODEL;
}

export function buildGeminiContents(
  history: AiMessage[],
  currentPrompt: string,
  augmentedPrompt: string
): GeminiContent[] {
  const relevantHistory = history.filter((message) => message.id !== 'welcome');
  const lastMessage = relevantHistory[relevantHistory.length - 1];
  const historyWithoutCurrent =
    lastMessage?.role === 'user' && lastMessage.content.trim() === currentPrompt.trim()
      ? relevantHistory.slice(0, -1)
      : relevantHistory;

  const formattedHistory: GeminiContent[] = historyWithoutCurrent.slice(-6).map((message) => ({
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
      ? new Set(evaluation.matchedRules.map((rule) => rule.severity))
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

export class GeminiProvider implements AiProvider {
  private readonly semanticCache = new Map<string, SemanticInterpretation>();

  constructor(
    private readonly engine: RuleEngine = ruleEngine,
    private readonly configuration: GeminiProviderConfiguration = {}
  ) {}

  private async requestWithModelFallback(
    apiKey: string,
    primaryModel: string,
    fallbackModel: string,
    contents: GeminiContent[],
    systemInstruction: string,
    maxOutputTokens: number
  ): Promise<GeminiRequestResult> {
    const primaryResponse = await requestGemini(
      apiKey,
      primaryModel,
      contents,
      systemInstruction,
      maxOutputTokens
    );
    if (primaryResponse.status !== 'rate_limited' || fallbackModel === primaryModel) {
      return primaryResponse;
    }
    return requestGemini(
      apiKey,
      fallbackModel,
      contents,
      systemInstruction,
      maxOutputTokens
    );
  }

  private getCachedInterpretation(key: string): SemanticInterpretation | undefined {
    const cached = this.semanticCache.get(key);
    if (!cached) return undefined;
    this.semanticCache.delete(key);
    this.semanticCache.set(key, cached);
    return cached;
  }

  private cacheInterpretation(key: string, interpretation: SemanticInterpretation): void {
    this.semanticCache.set(key, interpretation);
    if (this.semanticCache.size <= SEMANTIC_CACHE_LIMIT) return;
    const oldestKey = this.semanticCache.keys().next().value;
    if (typeof oldestKey === 'string') this.semanticCache.delete(oldestKey);
  }

  async generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history: AiMessage[] = []
  ): Promise<AiProviderResponse> {
    const contextualQuery = resolveContextualQuery(prompt, history);
    const rawBaseEvaluation = this.engine.evaluatePrompt(contextualQuery.query, service.id);
    let evaluation = applyConversationContext(rawBaseEvaluation, contextualQuery);
    const customKey = this.configuration.getApiKey?.()
      ?? storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '');
    const apiKey = customKey.trim();
    const selectedModel = normalizeGeminiModel(
      this.configuration.getModel?.()
        ?? storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, GEMINI_MODEL)
    );
    const selectedFallbackModel = normalizeGeminiModel(
      this.configuration.getFallbackModel?.() ?? GEMINI_FALLBACK_MODEL
    );
    let fallbackReason: AiProviderResponse['fallbackReason'] = apiKey ? undefined : 'no_api_key';

    if (apiKey) {
      if (rawBaseEvaluation.outcome === 'insufficient' && !rawBaseEvaluation.errorCode) {
        const serviceRecord = this.engine.getServices().find((item) => item.id === service.id);
        const serviceRules = this.engine.getRulesForService(service.id);
        if (serviceRecord) {
          const cacheKey = [
            service.id,
            rawBaseEvaluation.ruleStoreVersion,
            selectedModel,
            selectedFallbackModel,
            rawBaseEvaluation.normalizedQuery,
          ].join('|');
          let interpretation = this.getCachedInterpretation(cacheKey);

          if (!interpretation) {
            const selection = selectSemanticRuleCandidates(contextualQuery.query, serviceRules);
            const semanticPrompt = buildSemanticInterpretationPrompt(
              contextualQuery.query,
              serviceRecord,
              selection.rules
            );
            const semanticResponse = await this.requestWithModelFallback(
              apiKey,
              selectedModel,
              selectedFallbackModel,
              [{ role: 'user', parts: [{ text: semanticPrompt }] }],
              'Extraia somente mapeamentos semânticos aterrados no catálogo fornecido. Nunca decida a conclusão da análise.',
              1024
            );
            if (semanticResponse.status === 'ok' && semanticResponse.text) {
              interpretation = parseSemanticInterpretation(
                semanticResponse.text,
                contextualQuery.query,
                selection.rules
              ) ?? undefined;
              if (interpretation) {
                this.cacheInterpretation(cacheKey, interpretation);
              } else {
                fallbackReason = 'invalid_response';
              }
            } else {
              fallbackReason = semanticResponse.status === 'rate_limited'
                ? 'rate_limited'
                : semanticResponse.status === 'api_error'
                  ? 'api_error'
                  : 'invalid_response';
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
                provider: 'gemini',
                content: formatEvaluationResponse(evaluation),
                decision: evaluation.decision,
                evaluation,
              };
            }
            fallbackReason = 'invalid_response';
          }
        }
      } else if (this.configuration.humanizeDeterministicResponses !== false) {
        const augmentedPrompt = buildEvaluationPrompt(prompt, evaluation);
        const narrativeResponse = await this.requestWithModelFallback(
          apiKey,
          selectedModel,
          selectedFallbackModel,
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
              provider: 'gemini',
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
      apiKey &&
      rawBaseEvaluation.outcome === 'insufficient' &&
      !rawBaseEvaluation.errorCode &&
      !evaluation.semanticInterpretationApplied
    ) {
      evaluation = {
        ...evaluation,
        insufficiencyReason: 'semantic_unavailable',
        reasoningSummary: fallbackReason === 'rate_limited'
          ? 'O matching local não encontrou correspondência suficiente e o limite temporário do Gemini foi atingido.'
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
}

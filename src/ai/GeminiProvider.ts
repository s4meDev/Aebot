import type {
  AiMessage,
  AiProvider,
  AiProviderResponse,
  DecisionType,
  RuleEvaluationResult,
  SemanticRuleMapping,
  ServiceIdentity,
} from '../types';
import { GEMINI_MODEL } from '../localConfig';
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

const GEMINI_TIMEOUT_MS = 15_000;
const SEMANTIC_CACHE_LIMIT = 100;

interface GeminiRequestResult {
  status: 'ok' | 'api_error';
  text?: string;
}

export interface GeminiProviderConfiguration {
  getApiKey?: () => string;
  getModel?: () => string;
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
          },
        }),
      }
    );
    if (!response.ok) return { status: 'api_error' };
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? { status: 'ok', text } : { status: 'ok' };
  } catch (error) {
    console.warn('Erro ao chamar API do Gemini:', error);
    return { status: 'api_error' };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function normalizeGeminiModel(value: string): string {
  const candidate = value.trim();
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
    let fallbackReason: AiProviderResponse['fallbackReason'] = apiKey ? 'api_error' : 'no_api_key';

    if (apiKey) {
      if (rawBaseEvaluation.outcome === 'insufficient' && !rawBaseEvaluation.errorCode) {
        const serviceRecord = this.engine.getServices().find((item) => item.id === service.id);
        const serviceRules = this.engine.getRulesForService(service.id);
        if (serviceRecord) {
          const cacheKey = [
            service.id,
            rawBaseEvaluation.ruleStoreVersion,
            selectedModel,
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
            const semanticResponse = await requestGemini(
              apiKey,
              selectedModel,
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
              fallbackReason = semanticResponse.status === 'api_error'
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
      } else {
        const augmentedPrompt = buildEvaluationPrompt(prompt, evaluation);
        const narrativeResponse = await requestGemini(
          apiKey,
          selectedModel,
          buildGeminiContents(history, prompt, augmentedPrompt),
          context,
          512
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
          fallbackReason = 'api_error';
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
        reasoningSummary:
          'O matching local não encontrou correspondência suficiente e a interpretação semântica não pôde ser concluída ou validada.',
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

import type {
  AiMessage,
  AiProvider,
  AiProviderResponse,
  DecisionType,
  RuleEvaluationResult,
  ServiceIdentity,
} from '../types';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { storageAdapter } from '../storage/StorageAdapter';
import { GeminiProvider } from './GeminiProvider';
import { resolveBackendUrl } from './BackendClient';
import { ruleEngine } from '../services/RuleEngine';
import { formatEvaluationResponse } from '../services/ResponseFormatter';

const BACKEND_TIMEOUT_MS = 25_000;
const OFFICIAL_DECISIONS = new Set<DecisionType>(['Conforme', 'Não Conforme', 'Reprovado']);
const VALID_FALLBACK_REASONS = new Set<NonNullable<AiProviderResponse['fallbackReason']>>([
  'no_api_key',
  'api_error',
  'rate_limited',
  'invalid_response',
  'backend_error',
]);

function isEvaluation(value: unknown, serviceId: string): value is RuleEvaluationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evaluation = value as Record<string, unknown>;
  const decision = evaluation.decision;
  const outcome = String(evaluation.outcome);
  const advisory = evaluation.advisory;
  const advisoryRecord = advisory && typeof advisory === 'object' && !Array.isArray(advisory)
    ? advisory as Record<string, unknown>
    : null;
  const hasStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');
  const hasValidAdvisory = outcome === 'advisory'
    ? advisoryRecord !== null &&
      typeof advisoryRecord.summary === 'string' &&
      advisoryRecord.summary.trim().length > 0 &&
      typeof advisoryRecord.guidance === 'string' &&
      advisoryRecord.guidance.trim().length > 0 &&
      hasStringList(advisoryRecord.basisRuleIds) &&
      hasStringList(advisoryRecord.missingInformation)
    : advisory === undefined;
  const hasValidDecision = outcome === 'decision'
    ? OFFICIAL_DECISIONS.has(decision as DecisionType)
    : decision === null;
  return (
    evaluation.serviceId === serviceId &&
    typeof evaluation.ruleStoreVersion === 'string' &&
    typeof evaluation.normalizedQuery === 'string' &&
    ['decision', 'informational', 'advisory', 'insufficient'].includes(outcome) &&
    hasValidDecision &&
    hasValidAdvisory &&
    Array.isArray(evaluation.matchedRules) &&
    typeof evaluation.reasoningSummary === 'string'
  );
}

function parseBackendResponse(value: unknown, serviceId: string): AiProviderResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const result = body.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const response = result as Record<string, unknown>;
  if (typeof response.content !== 'string' || !isEvaluation(response.evaluation, serviceId)) {
    return null;
  }
  const evaluation = response.evaluation;
  const decision = response.decision;
  if (decision !== evaluation.decision) return null;
  const fallbackReason = response.fallbackReason;

  return {
    provider: 'backend',
    content: response.content,
    decision: evaluation.decision,
    evaluation,
    fallbackReason: typeof fallbackReason === 'string' && VALID_FALLBACK_REASONS.has(
      fallbackReason as NonNullable<AiProviderResponse['fallbackReason']>
    )
      ? fallbackReason as NonNullable<AiProviderResponse['fallbackReason']>
      : undefined,
  };
}

function canUseEmbeddedFallback(serviceId: string): boolean {
  const centralVersion = storageAdapter.get<string>(
    STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
    ''
  );
  // Sem uma versão central conhecida não dá para afirmar que a cópia local está atualizada.
  const sameKnownVersion = Boolean(centralVersion) &&
    centralVersion === ruleEngine.getRuleStoreVersion();
  const serviceExistsLocally = ruleEngine.getServices().some((service) => service.id === serviceId);
  return sameKnownVersion && serviceExistsLocally;
}

function createBackendUnavailableResponse(
  prompt: string,
  service: ServiceIdentity
): AiProviderResponse {
  const centralVersion = storageAdapter.get<string>(
    STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
    ''
  );
  const base = ruleEngine.evaluatePrompt(prompt, service.id);
  const evaluation: RuleEvaluationResult = {
    ...base,
    ruleStoreVersion: centralVersion || base.ruleStoreVersion,
    outcome: 'insufficient',
    decision: null,
    hasSufficientEvidence: false,
    matchedRules: [],
    primaryRule: null,
    conflicts: [],
    confidence: 'insuficiente',
    reasoningSummary:
      'O backend central está indisponível e a base embarcada não é compatível com o catálogo central selecionado.',
    requiresHumanValidation: true,
    advisory: undefined,
    insufficiencyReason: 'backend_unavailable',
    errorCode: undefined,
  };
  return {
    provider: 'simulated',
    content: formatEvaluationResponse(evaluation),
    decision: null,
    evaluation,
    fallbackReason: 'backend_error',
  };
}

export class BackendProvider implements AiProvider {
  constructor(private readonly fallbackProvider: AiProvider = new GeminiProvider()) {}

  async generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history: AiMessage[] = []
  ): Promise<AiProviderResponse> {
    const configuredUrl = storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '');
    const backendUrl = resolveBackendUrl(configuredUrl);
    if (!backendUrl) {
      return this.fallbackProvider.generateResponse(context, prompt, service, history);
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
    try {
      const token = storageAdapter.get<string>(STORAGE_KEYS.BACKEND_TOKEN, '').trim();
      const response = await fetch(`${backendUrl}/v1/analyze`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          serviceId: service.id,
          prompt,
          history: history
            .filter((message) => message.id !== 'welcome')
            .slice(-12),
        }),
      });
      if (!response.ok) throw new Error(`Backend respondeu HTTP ${response.status}`);
      const parsed = parseBackendResponse(await response.json(), service.id);
      if (!parsed) throw new Error('Contrato inválido retornado pelo backend');
      storageAdapter.set(
        STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
        parsed.evaluation.ruleStoreVersion
      );
      const localGeminiKey = storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '').trim();
      if (parsed.fallbackReason === 'no_api_key' && localGeminiKey) {
        const localResponse = await this.fallbackProvider.generateResponse(
          context,
          prompt,
          service,
          history
        );
        if (localResponse.provider === 'gemini') {
          return {
            ...localResponse,
            content: `${localResponse.content}\n\nObservação técnica:\nO backend está ativo, mas a interpretação online foi feita diretamente por este Chrome.`,
          };
        }
      }
      return parsed;
    } catch (error) {
      console.warn('Backend AEBOT indisponível:', error);
      // A contingência só pode decidir quando serviço e versão são exatamente os mesmos.
      if (!canUseEmbeddedFallback(service.id)) {
        return createBackendUnavailableResponse(prompt, service);
      }
      const fallback = await this.fallbackProvider.generateResponse(
        context,
        prompt,
        service,
        history
      );
      return {
        ...fallback,
        content: `${fallback.content}\n\nObservação técnica:\nO backend central não respondeu; esta análise usou apenas a base embarcada de contingência.`,
        fallbackReason: 'backend_error',
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export const assistantProvider = new BackendProvider();

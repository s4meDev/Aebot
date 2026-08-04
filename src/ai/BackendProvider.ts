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

const BACKEND_TIMEOUT_MS = 20_000;
const OFFICIAL_DECISIONS = new Set<DecisionType>(['Conforme', 'Não Conforme', 'Reprovado']);

export function normalizeBackendUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const localHttp =
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return null;
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isEvaluation(value: unknown, serviceId: string): value is RuleEvaluationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evaluation = value as Record<string, unknown>;
  const decision = evaluation.decision;
  return (
    evaluation.serviceId === serviceId &&
    typeof evaluation.ruleStoreVersion === 'string' &&
    typeof evaluation.normalizedQuery === 'string' &&
    ['decision', 'informational', 'insufficient'].includes(String(evaluation.outcome)) &&
    (decision === null || OFFICIAL_DECISIONS.has(decision as DecisionType)) &&
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

  return {
    provider: 'backend',
    content: response.content,
    decision: evaluation.decision,
    evaluation,
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
    const backendUrl = normalizeBackendUrl(configuredUrl);
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
      return parsed;
    } catch (error) {
      console.warn('Backend AEBOT indisponível:', error);
      const fallback = await this.fallbackProvider.generateResponse(
        context,
        prompt,
        service,
        history
      );
      return {
        ...fallback,
        content: `${fallback.content}\n\nObservação técnica:\nO backend central não respondeu; esta análise usou o modo local.`,
        fallbackReason: 'backend_error',
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export const assistantProvider = new BackendProvider();

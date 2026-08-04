import rulesStoreData from '../data/rulesStore.json';
import type {
  ConfidenceLevel,
  DataRule,
  DataService,
  RuleConclusionMeta,
  RuleEvaluationResult,
  RuleStoreSchema,
} from '../types';
import { classifyQueryIntent } from './QueryIntentClassifier';
import { resolveConflicts } from './ConflictResolver';
import { retrieveRules } from './RuleRetriever';
import { normalizeText } from './TextNormalizer';

function confidenceFromScore(score: number | undefined): ConfidenceLevel {
  if (score === undefined) return 'insuficiente';
  if (score >= 8.5) return 'alta';
  if (score >= 6.5) return 'média';
  return 'baixa';
}

export class RuleEngine {
  constructor(private readonly store: RuleStoreSchema = rulesStoreData as RuleStoreSchema) {}

  getServices(): DataService[] {
    return this.store.services;
  }

  getRulesForService(serviceId: string): DataRule[] {
    return this.store.rules.filter((rule) => rule.serviceId === serviceId);
  }

  getConclusions(): RuleConclusionMeta[] {
    return Object.values(this.store.conclusions).sort((left, right) => left.priority - right.priority);
  }

  evaluatePrompt(prompt: string, serviceId: string): RuleEvaluationResult {
    const normalized = normalizeText(prompt);
    const intent = classifyQueryIntent(normalized);
    const serviceExists = this.store.services.some((service) => service.id === serviceId);

    if (!serviceExists) {
      return {
        serviceId,
        normalizedQuery: normalized.value,
        intent,
        decision: null,
        hasSufficientEvidence: false,
        matchedRules: [],
        primaryRule: null,
        conflicts: [],
        confidence: 'insuficiente',
        reasoningSummary: 'O serviço selecionado não foi encontrado na base de regras.',
        requiresHumanValidation: true,
        errorCode: 'SERVICE_NOT_FOUND',
      };
    }

    const candidates = retrieveRules(normalized, intent, this.getRulesForService(serviceId));
    const { rankedRules, primaryRule, conflicts } = resolveConflicts(
      candidates,
      this.getConclusions()
    );

    if (!primaryRule) {
      const reasoningSummary =
        intent === 'pergunta_informativa'
          ? 'A pergunta não descreve um fato ou cenário que corresponda a uma regra cadastrada.'
          : 'A base não possui regra suficiente para os fatos informados.';
      return {
        serviceId,
        normalizedQuery: normalized.value,
        intent,
        decision: null,
        hasSufficientEvidence: false,
        matchedRules: [],
        primaryRule: null,
        conflicts: [],
        confidence: 'insuficiente',
        reasoningSummary,
        requiresHumanValidation: true,
      };
    }

    const prefix =
      intent === 'hipotese'
        ? 'No cenário descrito, '
        : intent === 'pergunta_informativa'
          ? 'Para o cenário consultado, '
          : '';
    const conflictSummary = conflicts.length
      ? ` Em conflito, a regra ${primaryRule.id} prevaleceu pelos critérios de aplicabilidade e desempate.`
      : '';
    const additionalRules = rankedRules.length > 1
      ? ` Outras regras relevantes: ${rankedRules.slice(1).map((rule) => rule.id).join(', ')}.`
      : '';

    return {
      serviceId,
      normalizedQuery: normalized.value,
      intent,
      decision: primaryRule.severity,
      hasSufficientEvidence: true,
      matchedRules: rankedRules,
      primaryRule,
      conflicts,
      confidence: confidenceFromScore(primaryRule.score),
      reasoningSummary: `${prefix}${primaryRule.message}${additionalRules}${conflictSummary}`.trim(),
      requiresHumanValidation: false,
    };
  }
}

export const ruleEngine = new RuleEngine();

import rulesStoreData from '../data/rulesStore.json';
import type {
  ConfidenceLevel,
  DataRule,
  DataService,
  RuleConclusionMeta,
  RuleEvaluationResult,
  RuleStoreSchema,
} from '../types';
import { classifyQueryIntent, isServiceOverviewQuestion } from './QueryIntentClassifier';
import { resolveConflicts } from './ConflictResolver';
import { retrieveInformationalRules, retrieveRules } from './RuleRetriever';
import { normalizeText } from './TextNormalizer';
import { parseRuleStore } from './RuleStoreValidator';

function confidenceFromScore(score: number | undefined): ConfidenceLevel {
  if (score === undefined) return 'insuficiente';
  if (score >= 8.5) return 'alta';
  if (score >= 6.5) return 'média';
  return 'baixa';
}

export class RuleEngine {
  private readonly store: RuleStoreSchema;

  constructor(store: unknown = rulesStoreData) {
    this.store = parseRuleStore(store);
  }

  getServices(): DataService[] {
    return this.store.services;
  }

  getRulesForService(serviceId: string): DataRule[] {
    return this.store.rules.filter((rule) => rule.serviceId === serviceId);
  }

  getConclusions(): RuleConclusionMeta[] {
    return Object.values(this.store.conclusions).sort((left, right) => left.priority - right.priority);
  }

  getRuleStoreVersion(): string {
    return this.store.version;
  }

  evaluatePrompt(prompt: string, serviceId: string): RuleEvaluationResult {
    const normalized = normalizeText(prompt);
    const intent = classifyQueryIntent(normalized);
    const service = this.store.services.find((item) => item.id === serviceId);

    if (!service) {
      return {
        serviceId,
        ruleStoreVersion: this.store.version,
        normalizedQuery: normalized.value,
        contextApplied: false,
        intent,
        outcome: 'insufficient',
        decision: null,
        hasSufficientEvidence: false,
        matchedRules: [],
        primaryRule: null,
        conflicts: [],
        confidence: 'insuficiente',
        reasoningSummary: 'O serviço selecionado não foi encontrado na base de regras.',
        requiresHumanValidation: true,
        insufficiencyReason: 'service_not_found',
        errorCode: 'SERVICE_NOT_FOUND',
      };
    }

    const serviceContext = {
      name: service.name,
      summary: service.summary,
      insights: service.insights,
    };

    const serviceRules = this.getRulesForService(serviceId);
    const candidates = retrieveRules(normalized, intent, serviceRules);
    const topicalCandidates = retrieveInformationalRules(normalized, serviceRules);

    if (intent === 'pergunta_informativa') {
      const candidatesById = new Map<string, (typeof candidates)[number]>();
      for (const rule of [...candidates, ...topicalCandidates]) {
        const current = candidatesById.get(rule.id);
        if (!current || rule.score > current.score) candidatesById.set(rule.id, rule);
      }
      const { rankedRules, primaryRule } = resolveConflicts(
        [...candidatesById.values()],
        this.getConclusions()
      );

      if (primaryRule) {
        const additionalRules = rankedRules.length > 1
          ? ` Também se relacionam à dúvida: ${rankedRules.slice(1).map((rule) => rule.id).join(', ')}.`
          : '';
        return {
          serviceId,
          ruleStoreVersion: this.store.version,
          normalizedQuery: normalized.value,
          contextApplied: false,
          intent,
          outcome: 'informational',
          decision: null,
          hasSufficientEvidence: false,
          matchedRules: rankedRules,
          primaryRule,
          conflicts: [],
          confidence: confidenceFromScore(primaryRule.score),
          reasoningSummary: `A regra ${primaryRule.id} — ${primaryRule.title} prevê ${primaryRule.severity} quando o cenário nela descrito for confirmado.${additionalRules}`,
          requiresHumanValidation: false,
          serviceContext,
        };
      }

      if (isServiceOverviewQuestion(normalized)) {
        const highlights = service.insights.slice(0, 3).join(' ');
        return {
          serviceId,
          ruleStoreVersion: this.store.version,
          normalizedQuery: normalized.value,
          contextApplied: false,
          intent,
          outcome: 'informational',
          decision: null,
          hasSufficientEvidence: false,
          matchedRules: [],
          primaryRule: null,
          conflicts: [],
          confidence: 'média',
          reasoningSummary: `${service.summary}${highlights ? ` ${highlights}` : ''}`,
          requiresHumanValidation: false,
          serviceContext,
        };
      }
    }

    const { rankedRules, primaryRule, conflicts } = resolveConflicts(
      candidates,
      this.getConclusions()
    );

    if (!primaryRule) {
      const { rankedRules: relatedRules } = resolveConflicts(
        topicalCandidates,
        this.getConclusions()
      );
      const hasRelatedRules = relatedRules.length > 0;
      const reasoningSummary =
        hasRelatedRules
          ? `Foram encontradas regras relacionadas (${relatedRules.map((rule) => rule.id).join(', ')}), mas os fatos informados não são suficientes para recomendar uma conclusão.`
          : intent === 'pergunta_informativa'
          ? 'A pergunta não descreve um fato ou cenário que corresponda a uma regra cadastrada.'
          : 'A base não possui regra suficiente para os fatos informados.';
      return {
        serviceId,
        ruleStoreVersion: this.store.version,
        normalizedQuery: normalized.value,
        contextApplied: false,
        intent,
        outcome: 'insufficient',
        decision: null,
        hasSufficientEvidence: false,
        matchedRules: relatedRules,
        primaryRule: null,
        conflicts: [],
        confidence: 'insuficiente',
        reasoningSummary,
        requiresHumanValidation: true,
        insufficiencyReason: hasRelatedRules ? 'missing_information' : 'no_matching_rule',
        serviceContext,
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
      ruleStoreVersion: this.store.version,
      normalizedQuery: normalized.value,
      contextApplied: false,
      intent,
      outcome: 'decision',
      decision: primaryRule.severity,
      hasSufficientEvidence: true,
      matchedRules: rankedRules,
      primaryRule,
      conflicts,
      confidence: confidenceFromScore(primaryRule.score),
      reasoningSummary: `${prefix}${primaryRule.message}${additionalRules}${conflictSummary}`.trim(),
      requiresHumanValidation: false,
      serviceContext,
    };
  }
}

export const ruleEngine = new RuleEngine();

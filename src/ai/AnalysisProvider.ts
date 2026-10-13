// Coordeno interpretação, contexto e regras sem depender do nome de um provedor.
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
import { ruleEngine, type RuleEngine } from '../services/RuleEngine';
import {
  formatEvaluationResponse,
  type ResponseNarrative,
} from '../services/ResponseFormatter';
import {
  buildEvaluationPrompt,
  buildSemanticInterpretationPrompt,
} from './PromptBuilder';
import { createLocalInterpretation } from './LocalInterpretation';
import { createLocalMappingVerification, preferExplicitLocalEvidence } from './LocalMappingVerification';
import { resolveContextualQuery } from '../services/ConversationContextResolver';
import {
  parseSemanticInterpretation,
  type SemanticInterpretation,
} from '../services/SemanticInterpreter';
import { selectSemanticRuleCandidates } from '../services/SemanticRuleRetriever';
import { inspectAnalysisCoverage, incompleteAnalysis, isKnownContextAnswer } from '../services/AnalysisCoverage';
import { detectSemanticPolarity } from '../services/SemanticPolarity';
import type {
  StructuredModelClient,
  StructuredModelProvider,
} from './StructuredModelClient';

import { getBrowserGeminiClient, type BrowserGeminiConfiguration } from './GeminiModelClient';
import { buildModelContents } from './ModelContents';

const SEMANTIC_CACHE_LIMIT = 1_000;
const SEMANTIC_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['mappings', 'conversation'],
  properties: {
    mappings: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['ruleId', 'sourceQuote', 'stance'],
        properties: {
          ruleId: { type: 'string' },
          sourceQuote: { type: 'string' },
          stance: {
            type: 'string',
            enum: ['asserted', 'hypothetical', 'informational', 'negated_or_present'],
          },
        },
      },
    },
    conversation: {
      type: 'object',
      required: ['answer', 'question'],
      properties: {
        answer: { type: 'string' },
        question: { type: 'string' },
      },
    },
  },
};
const NARRATIVE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['answer', 'question'],
  properties: {
    answer: { type: 'string' },
    question: { type: 'string' },
  },
};

export interface AnalysisProviderConfiguration extends BrowserGeminiConfiguration {
  /** O desktop injeta somente IA local. Perfis online podem injetar sua cadeia. */
  getModelClient?: () => StructuredModelClient | null;
  humanizeDeterministicResponses?: boolean;
}

interface SemanticAttempt {
  interpretation?: SemanticInterpretation;
  provider: StructuredModelProvider;
  fallbackReason?: AiProviderResponse['fallbackReason'];
  modelAttempts: NonNullable<AiProviderResponse['modelAttempts']>;
}

async function buildPrivateCacheKey(parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
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
    const answer = typeof parsed.answer === 'string'
      ? parsed.answer.trim()
      : typeof parsed.justification === 'string'
        ? parsed.justification.trim()
        : '';
    const question = typeof parsed.question === 'string'
      ? parsed.question.trim()
      : '';
    const legacyGuidance = typeof parsed.guidance === 'string'
      ? parsed.guidance.trim()
      : '';
    if (!answer || answer.length > 600 || question.length > 220 || legacyGuidance.length > 300) {
      return null;
    }
    const questionMarks = (answer.match(/\?/g)?.length ?? 0) +
      (question.match(/\?/g)?.length ?? 0);
    if (answer.split(/\r?\n/).length > 6 || questionMarks > 1) return null;

    const combined = `${answer} ${question} ${legacyGuidance}`;
    const decisions = mentionsDecision(combined);
    const matchedDecisions = evaluation.matchedRules.flatMap(
      (rule) => rule.severity ? [rule.severity] : []
    );
    const advisoryDecisions = evaluation.outcome === 'advisory' && question
      ? mentionsDecision(
          `${evaluation.advisory?.summary ?? ''} ${evaluation.advisory?.guidance ?? ''}`
        )
      : [];
    const allowedDecisions = evaluation.outcome === 'informational' ||
      (evaluation.outcome === 'advisory' && Boolean(question))
      ? new Set([...matchedDecisions, ...advisoryDecisions])
      : new Set(evaluation.decision ? [evaluation.decision] : []);
    if (decisions.some((decision) => !allowedDecisions.has(decision))) return null;

    const mentionedRuleIds = combined.match(/RULE-[A-Z0-9-]+/gi) ?? [];
    const knownRuleIds = new Set(evaluation.matchedRules.map((rule) => rule.id.toUpperCase()));
    if (mentionedRuleIds.some((id) => !knownRuleIds.has(id.toUpperCase()))) return null;

    return parsed.answer !== undefined
      ? { answer, followUpQuestion: question || undefined }
      : { justification: answer, guidance: legacyGuidance };
  } catch {
    return null;
  }
}

function parseSemanticNarrative(
  interpretation: SemanticInterpretation,
  evaluation: RuleEvaluationResult
): ResponseNarrative | null {
  if (!interpretation.conversation) return null;
  return parseNarrative(JSON.stringify({
    answer: interpretation.conversation.answer,
    question: interpretation.conversation.question ?? '',
  }), evaluation);
}

function applyFollowUpQuestion(
  evaluation: RuleEvaluationResult,
  narrative: ResponseNarrative | null
): RuleEvaluationResult {
  return narrative?.followUpQuestion
    ? { ...evaluation, followUpQuestion: narrative.followUpQuestion }
    : evaluation;
}

function applyConversationContext(
  baseEvaluation: RuleEvaluationResult,
  contextualQuery: ReturnType<typeof resolveContextualQuery>
): RuleEvaluationResult {
  if (!contextualQuery.contextApplied) return baseEvaluation;

  const isCorrectionWithoutDecision =
    contextualQuery.mode === 'correction' &&
    (baseEvaluation.outcome === 'insufficient' || baseEvaluation.outcome === 'advisory') &&
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
    advisory: isCorrectionWithoutDecision ? undefined : baseEvaluation.advisory,
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
    rule.matchReasons.some((reason) =>
      reason !== 'tema da regra identificado' &&
      !reason.startsWith('conceitos relacionados identificados')
    )
  );
}

function preserveConfirmedFacts(interpretation: SemanticInterpretation, known: SemanticRuleMapping[],
  query: string, rules: DataRule[], allowSingleTokenQuote: boolean): SemanticInterpretation | null {
  if (!known.length) return interpretation;
  const knownIds = new Set(known.map(mapping => mapping.ruleId));
  const mappings = [...known, ...interpretation.mappings.filter(mapping =>
    mapping.stance !== 'negated_or_present' || !knownIds.has(mapping.ruleId))].filter((mapping, index, all) =>
    all.findIndex(item => item.ruleId === mapping.ruleId && item.sourceQuote === mapping.sourceQuote &&
      item.stance === mapping.stance) === index);
  const merged = parseSemanticInterpretation(JSON.stringify({ mappings }), query, rules, { allowSingleTokenQuote });
  return merged ? { ...interpretation, mappings: merged.mappings } : null;
}

export class AnalysisProvider implements AiProvider {
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
    private readonly configuration: AnalysisProviderConfiguration = {}
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
    currentPrompt: string,
    history: AiMessage[],
    service: DataService,
    rules: DataRule[],
    modelClient: StructuredModelClient,
    clarificationApplied: boolean,
    clarificationQuestions: string[] = [],
    knownMappings: SemanticRuleMapping[] = []
  ): Promise<SemanticAttempt> {
    const pending = this.semanticInFlight.get(cacheKey);
    if (pending) {
      this.metrics.coalescedRequests += 1;
      return pending;
    }

    const request = (async (): Promise<SemanticAttempt> => {
      // Regras agregadoras são calculadas pelo motor a partir dos fatos individuais.
      // O modelo não pode pular essa comprovação escolhendo diretamente a soma.
      const atomicRules = rules.filter((rule) => !rule.matchPolicy?.minimumMatchedFactGroups);
      const selection = selectSemanticRuleCandidates(query, atomicRules, modelClient.provider === 'local' ? 6 : undefined);
      const localRequest = modelClient.provider === 'local' ? createLocalInterpretation(
        // A ficha precisa das alternativas do serviço, inclusive evidências presentes.
        // A busca por faltas pode cortá-las e induzir o modelo a confundir os grupos.
        query, service, selection.rules, clarificationQuestions, { allowSingleTokenQuote: clarificationApplied }, atomicRules,
        modelClient.localInterpretationProtocol
      ) : undefined;
      const parseInterpretation = localRequest?.parse ?? ((text: string) => parseSemanticInterpretation(
        text, query, selection.rules, { allowSingleTokenQuote: clarificationApplied }
      ));
      const semanticPrompt = localRequest?.prompt ?? buildSemanticInterpretationPrompt(
        query,
        service,
        selection.rules,
        { clarificationApplied, clarificationQuestions }
      );
      this.metrics.modelRequests += 1;
      const response = await modelClient.request(
        buildModelContents(history, currentPrompt, localRequest?.inputPrompt ?? semanticPrompt),
        modelClient.provider === 'local'
          ? localRequest?.systemInstruction ?? 'Extraia fielmente os fatos do relato e preencha o JSON solicitado. Distinga evidências presentes, ausentes e não informadas, citando os trechos corretos. A decisão pertence ao motor de regras.'
          : 'Converse como um Analista Sênior: compreenda livremente a linguagem, seja breve e use somente o catálogo fornecido para regras e conclusões oficiais.',
        1536,
        {
          responseSchema: localRequest?.schema ?? SEMANTIC_RESPONSE_SCHEMA,
          validateText: (text) => parseInterpretation(text) !== null,
        }
      );
      if (response.status !== 'ok' || !response.text) {
        return {
          provider: response.provider,
          fallbackReason: response.status === 'rate_limited' ? 'rate_limited'
            : response.attempts?.[response.attempts.length - 1]?.status === 'invalid_response' ? 'invalid_response' : 'api_error',
          modelAttempts: response.attempts ?? [],
        };
      }
      let interpretation = parseInterpretation(response.text) ?? undefined;
      if (modelClient.provider === 'local' && interpretation && knownMappings.length) {
        interpretation = preserveConfirmedFacts(interpretation, knownMappings, query, atomicRules, clarificationApplied) ?? undefined;
      }
      if (modelClient.provider === 'local' && interpretation) interpretation = preferExplicitLocalEvidence(interpretation, atomicRules);
      const attempts = [...(response.attempts ?? [])];
      const verification = modelClient.provider === 'local' && interpretation
        ? createLocalMappingVerification(query, service, atomicRules, interpretation,
          modelClient.localInterpretationProtocol === 'indexed') : undefined;
      if (verification) {
        this.metrics.modelRequests += 1;
        const checked = await modelClient.request([{ role: 'user', parts: [{ text: verification.prompt }] }],
          // O modo da chamada vai no pedido, não em outro prefixo de sistema.
          // Assim a conferência reaproveita o catálogo sem perder nenhuma validação.
          localRequest?.systemInstruction ?? 'Confira se cada regra indicada tem fundamento no relato. Não acrescente fatos nem conclua a OS.',
          512, { responseSchema: verification.schema, validateText: (text) => verification.parse(text) !== null });
        attempts.push(...(checked.attempts ?? []));
        interpretation = checked.status === 'ok' && checked.text ? verification.parse(checked.text) ?? undefined : undefined;
        if (!interpretation) return { provider: checked.provider, modelAttempts: attempts,
          fallbackReason: checked.status === 'rate_limited' ? 'rate_limited'
            : checked.status === 'ok' ? 'invalid_response' : 'api_error' };
        // Uma conferência semântica pode excluir sua própria hipótese, não um
        // fato que o motor já comprovou no relato completo pelas regras cadastradas.
        interpretation = preserveConfirmedFacts(interpretation, knownMappings, query, atomicRules, clarificationApplied) ?? undefined;
      }
      return {
        interpretation,
        provider: response.provider,
        fallbackReason: interpretation ? undefined : 'invalid_response',
        modelAttempts: attempts,
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
    const serviceRules = this.engine.getRulesForService(service.id);
    const coverage = inspectAnalysisCoverage(contextualQuery.query, serviceRules, rawBaseEvaluation.intent);
    const contextOnlyAnswer = contextualQuery.clarificationApplied === true && isKnownContextAnswer(prompt,
      serviceRules.filter(rule => rawBaseEvaluation.matchedRules.some(match => match.id === rule.id)));
    let evaluation = applyConversationContext(rawBaseEvaluation, contextualQuery);
    const modelClient = this.configuration.getModelClient
      ? this.configuration.getModelClient()
      : getBrowserGeminiClient(this.configuration);
    let fallbackReason: AiProviderResponse['fallbackReason'] = modelClient
      ? undefined
      : 'no_api_key';
    const modelAttempts: NonNullable<AiProviderResponse['modelAttempts']> = [];

    // Fato explícito já coberto por orientação da base não precisa de outra
    // inferência para repetir a resposta ou a pergunta de contexto faltante.
    // Correspondência apenas temática continua passando pela interpretação.
    const knownGuidance = modelClient?.provider === 'local' &&
      this.configuration.humanizeDeterministicResponses === false &&
      rawBaseEvaluation.outcome === 'advisory' &&
      rawBaseEvaluation.primaryRule?.severity === null &&
      rawBaseEvaluation.primaryRule.factMatchQuality >= 0.8 && coverage.unresolvedSources.length === 0;
    if (knownGuidance) {
      return { provider: 'simulated', content: formatEvaluationResponse(evaluation),
        decision: null, evaluation, modelAttempts };
    }

    // A IA interpreta a linguagem e já produz uma resposta curta. O motor apenas
    // valida a regra e a conclusão oficial antes de liberar o texto ao analista.
    if (modelClient) {
      const needsSemanticInterpretation =
        (rawBaseEvaluation.outcome !== 'decision' || (modelClient.provider === 'local' && coverage.unresolvedSources.length > 0 &&
          !contextOnlyAnswer)) &&
        !rawBaseEvaluation.errorCode;

      if (needsSemanticInterpretation) {
        const serviceRecord = this.engine.getServices().find((item) => item.id === service.id);
        if (serviceRecord) {
          const recentConversation = JSON.stringify(history.slice(-6).map(message => ({
            role: message.role, content: message.content, contextQuery: message.contextQuery,
            pendingInformation: message.pendingInformation ?? [],
          })));
          const cacheKey = await buildPrivateCacheKey([
            service.id,
            rawBaseEvaluation.ruleStoreVersion,
            modelClient.cacheKey,
            // Pontuação e acentos podem mudar intenção e citação. O hash usa
            // o relato original; a chave e os diagnósticos não expõem esse texto.
            contextualQuery.query,
            rawBaseEvaluation.intent,
            recentConversation,
          ]);
          const cachedInterpretation = this.getCachedInterpretation(cacheKey);
          let interpretation = cachedInterpretation?.interpretation;
          let semanticProvider = cachedInterpretation?.provider ?? modelClient.provider;

          if (!interpretation) {
            const semanticAttempt = await this.requestSemanticInterpretation(
              cacheKey,
              contextualQuery.query,
              prompt,
              history,
              serviceRecord,
              serviceRules,
              modelClient,
              contextualQuery.clarificationApplied === true,
              contextualQuery.clarificationQuestions,
              modelClient.provider === 'local' && rawBaseEvaluation.outcome === 'decision' ? coverage.confirmedMappings.filter(mapping =>
                rawBaseEvaluation.matchedRules.some(rule => rule.id === mapping.ruleId)) : []
            );
            interpretation = semanticAttempt.interpretation;
            semanticProvider = semanticAttempt.provider;
            fallbackReason = semanticAttempt.fallbackReason;
            modelAttempts.push(...semanticAttempt.modelAttempts);
            if (interpretation) {
              this.cacheInterpretation(cacheKey, interpretation, semanticProvider);
            }
          }

          if (interpretation) {
            // Passa os fatos e suas citações, não uma frase montada para buscar
            // todas as regras novamente. Desktop e legado usam a mesma entrada.
            const hasActionableMapping = interpretation.mappings.some(
              (mapping) => mapping.stance !== 'negated_or_present'
            );
            const semanticBase = hasActionableMapping
              ? this.engine.evaluateFacts({
                  query: contextualQuery.query,
                  serviceId: service.id,
                  mappings: interpretation.mappings,
                  allowSingleTokenQuote: contextualQuery.clarificationApplied === true,
                })
              : rawBaseEvaluation;
            const usableSemanticEvaluation =
              semanticBase.outcome !== 'insufficient' || !hasActionableMapping;
            if (usableSemanticEvaluation) {
              evaluation = applySemanticMetadata(
                applyConversationContext(semanticBase, contextualQuery),
                rawBaseEvaluation.normalizedQuery,
                interpretation.mappings
              );
            }

            // Uma falta ou ocorrência desconhecida em outra oração não pode
            // sumir só porque uma regra conhecida já casou. Presença isolada
            // pode ser omitida pelo contrato; ela não é uma nova irregularidade.
            const omittedFact = coverage.unresolvedSources.some(source => detectSemanticPolarity(source) !== 'present' &&
              !interpretation.mappings.some(mapping => mapping.stance !== 'negated_or_present' &&
                (source.toLocaleLowerCase('pt-BR').includes(mapping.sourceQuote.toLocaleLowerCase('pt-BR')) ||
                  mapping.sourceQuote.toLocaleLowerCase('pt-BR').includes(source.toLocaleLowerCase('pt-BR')))));
            if (modelClient.provider === 'local' && evaluation.decision && omittedFact) {
              evaluation = incompleteAnalysis(evaluation);
              return { provider: semanticProvider, content: formatEvaluationResponse(evaluation), decision: null,
                evaluation, modelAttempts, fallbackReason: 'invalid_response' };
            }

            const narrative = parseSemanticNarrative(interpretation, evaluation);
            evaluation = applyFollowUpQuestion(evaluation, narrative);
            return {
              provider: semanticProvider,
              content: formatEvaluationResponse(evaluation, narrative ?? undefined),
              decision: evaluation.decision,
              evaluation,
              fallbackReason: narrative
                ? undefined
                : interpretation.conversation || !usableSemanticEvaluation
                  ? 'invalid_response'
                  : undefined,
              modelAttempts,
            };
          }
        }
      } else if (
        !rawBaseEvaluation.errorCode &&
        this.configuration.humanizeDeterministicResponses !== false
      ) {
        const augmentedPrompt = buildEvaluationPrompt(prompt, evaluation);
        this.metrics.modelRequests += 1;
        const narrativeResponse = await modelClient.request(
          buildModelContents(history, prompt, augmentedPrompt),
          context,
          768,
          { responseSchema: NARRATIVE_RESPONSE_SCHEMA }
        );
        modelAttempts.push(...(narrativeResponse.attempts ?? []));
        if (narrativeResponse.status === 'ok') {
          const narrative = narrativeResponse.text
            ? parseNarrative(narrativeResponse.text, evaluation)
            : null;
          if (narrative) {
            evaluation = applyFollowUpQuestion(evaluation, narrative);
            return {
              provider: narrativeResponse.provider,
              content: formatEvaluationResponse(evaluation, narrative),
              decision: evaluation.decision,
              evaluation,
              modelAttempts,
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

    if (modelClient?.provider === 'local' && rawBaseEvaluation.outcome === 'decision' &&
        coverage.unresolvedSources.length && !evaluation.semanticInterpretationApplied &&
        !contextOnlyAnswer) {
      evaluation = incompleteAnalysis(evaluation);
    }

    if (
      modelClient &&
      rawBaseEvaluation.outcome === 'insufficient' &&
      !hasGroundedRuleMatch(rawBaseEvaluation) &&
      !rawBaseEvaluation.errorCode &&
      !evaluation.semanticInterpretationApplied
    ) {
      // Falha do modelo só substitui uma ausência real de resposta local.
      // Uma orientação ou explicação já fundamentada continua útil, mesmo
      // quando Gemini e a contingência não entregam um JSON válido.
      evaluation = {
        ...evaluation,
        outcome: 'insufficient',
        decision: null,
        hasSufficientEvidence: false,
        matchedRules: [],
        primaryRule: null,
        conflicts: [],
        confidence: 'insuficiente',
        advisory: undefined,
        insufficiencyReason: 'semantic_unavailable',
        reasoningSummary: modelClient.provider === 'local'
          ? 'Não consegui validar a interpretação completa na IA deste computador. O caso precisa de esclarecimento ou conferência humana.'
          : fallbackReason === 'rate_limited'
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
      modelAttempts,
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

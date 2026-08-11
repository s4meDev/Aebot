export type DecisionType = 'Conforme' | 'Não Conforme' | 'Reprovado';

export type QueryIntent =
  | 'relato_afirmativo'
  | 'hipotese'
  | 'pergunta_informativa'
  | 'indefinida';

export type ConfidenceLevel = 'insuficiente' | 'baixa' | 'média' | 'alta';

export type EvaluationOutcome = 'decision' | 'informational' | 'insufficient';

export type InsufficiencyReason =
  | 'missing_information'
  | 'no_matching_rule'
  | 'semantic_unavailable'
  | 'backend_unavailable'
  | 'service_rules_pending'
  | 'service_not_found';

export type ServiceAnalysisStatus = 'active' | 'rules_pending';
export type CatalogNameStatus = 'confirmed' | 'needs_confirmation';

/** Relações permitidas no sistema. Adicional também pode ser chamado de desdobro. */
export interface ServiceParameterization {
  serviceExchange?: string[];
  executedAdditional?: string[];
  subsequentAdditional?: string[];
}

export interface RuleConditionGroup {
  label: string;
  expressions: string[];
}

export interface RuleMatchPolicy {
  /** Exige que todas as expressões sejam encontradas. */
  allOf?: string[];
  /** Exige uma quantidade mínima de grupos de fatos distintos. */
  minimumGroups?: {
    count: number;
    /** Sinais aplicados por proximidade a cada grupo de evidência. */
    positiveSignals?: string[];
    /** Sinais de presença/correção que anulam o positivo mais distante. */
    negativeSignals?: string[];
    groups: RuleConditionGroup[];
  };
  /**
   * Exige fatos já confirmados por outras regras em grupos distintos.
   * Permite compor regras sem duplicar todos os sinônimos das regras-base.
   */
  minimumMatchedFactGroups?: {
    count: number;
    groups: string[];
  };
}

export interface DataRule {
  id: string;
  /** Serviço principal da regra. */
  serviceId: string;
  /** Outros serviços que compartilham exatamente a mesma regra, sem duplicá-la na base. */
  applicableServiceIds?: string[];
  title: string;
  description: string;
  /** Conclusão oficial. Ausente em orientações que não definem classificação da OS. */
  severity?: DecisionType;
  priority: number;
  /** Frases que, sozinhas, descrevem o cenário da regra. */
  conditionKeywords: string[];
  message: string;
  equivalentExpressions?: string[];
  /** Sinais linguísticos de ocorrência, combinados com relatedEvidence. */
  positiveSignals?: string[];
  /** Sinais que negam ou excepcionam a ocorrência. */
  negativeSignals?: string[];
  mandatoryConditions?: string[];
  exceptions?: string[];
  examples?: string[];
  guidance?: string;
  category?: string;
  relatedEvidence?: string[];
  /** Termos usados somente para localizar a regra em perguntas informativas. */
  topicKeywords?: string[];
  /** Referências opcionais; regras informadas pelos responsáveis não dependem de documento formal. */
  sourceReferences?: string[];
  /** Grupo factual reutilizável por regras agregadoras do mesmo serviço. */
  factGroup?: string;
  matchPolicy?: RuleMatchPolicy;
}

export interface DataService {
  id: string;
  name: string;
  category: string;
  summary: string;
  insights: string[];
  suggestedQuestions?: string[];
  /** Impede análise oficial enquanto as regras próprias do serviço não foram cadastradas. */
  analysisStatus?: ServiceAnalysisStatus;
  /** Opções configuradas para este serviço quando ele é a OS original. */
  parameterization?: ServiceParameterization;
  /** A captura pode cortar o final do nome; isso fica explícito até a confirmação. */
  catalogNameStatus?: CatalogNameStatus;
  sourceLabel?: string;
}

export interface RuleConclusionMeta {
  severity: DecisionType;
  priority: number;
  description: string;
}

export interface RuleStoreSchema {
  version: string;
  conclusions: Record<DecisionType, RuleConclusionMeta>;
  services: DataService[];
  rules: DataRule[];
}

export interface MatchedRule {
  id: string;
  title: string;
  severity: DecisionType | null;
  priority: number;
  /** Pontuação técnica de 0 a 10, usada apenas para ordenação. */
  score: number;
  factMatchQuality: number;
  specificity: number;
  relevance: number;
  matchReasons: string[];
  matchedTerms: string[];
  /** Regras-base cujos fatos distintos sustentaram uma regra agregadora. */
  supportingRuleIds?: string[];
  guidance?: string;
  message: string;
}

export interface EvaluationConflict {
  ruleIds: string[];
  decisions: DecisionType[];
  winnerRuleId: string;
  resolution: string;
}

export type SemanticMappingStance =
  | 'asserted'
  | 'hypothetical'
  | 'informational'
  | 'negated_or_present';

export interface SemanticRuleMapping {
  ruleId: string;
  /** Trecho literal da pergunta que sustenta o mapeamento. */
  sourceQuote: string;
  /** Expressão escolhida literalmente entre as condições cadastradas da regra. */
  canonicalExpression: string;
  stance: SemanticMappingStance;
}

export interface RuleEvaluationResult {
  serviceId: string;
  ruleStoreVersion: string;
  normalizedQuery: string;
  /** Indica que uma continuação explícita foi ligada à última pergunta do analista. */
  contextApplied: boolean;
  intent: QueryIntent;
  outcome: EvaluationOutcome;
  decision: DecisionType | null;
  hasSufficientEvidence: boolean;
  matchedRules: MatchedRule[];
  primaryRule: MatchedRule | null;
  conflicts: EvaluationConflict[];
  confidence: ConfidenceLevel;
  reasoningSummary: string;
  requiresHumanValidation: boolean;
  /** A linguagem livre foi aterrada em expressões cadastradas antes da avaliação. */
  semanticInterpretationApplied?: boolean;
  semanticMappings?: SemanticRuleMapping[];
  insufficiencyReason?: InsufficiencyReason;
  serviceContext?: {
    name: string;
    summary: string;
    insights: string[];
  };
  errorCode?: 'SERVICE_NOT_FOUND' | 'SERVICE_RULES_PENDING';
}

/** Identidade mínima do serviço selecionado na interface. */
export interface ServiceIdentity {
  id: string;
  name: string;
}

export interface ServiceRecord extends DataService {
  businessRules: DataRule[];
}

export interface ServiceRepositoryResult {
  type: 'success' | 'error';
  services?: ServiceRecord[];
  message?: string;
}

export interface ServiceCatalogResult {
  type: 'success' | 'error';
  services?: ServiceRecord[];
  source?: 'backend' | 'local';
  ruleStoreVersion?: string;
  /** Aviso operacional quando o catálogo local foi usado como contingência. */
  warning?: string;
  message?: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Consulta contextual acumulada, usada apenas pelo motor determinístico. */
  contextQuery?: string;
  timestamp: string;
  decision?: DecisionType;
}

/** Contrato compartilhado pela API Node, Cloudflare Worker e testes. */
export interface AnalysisRequest {
  serviceId: string;
  prompt: string;
  history: AiMessage[];
}

export interface AiProviderResponse {
  content: string;
  provider: 'backend' | 'gemini' | 'ollama' | 'workers-ai' | 'simulated';
  decision: DecisionType | null;
  evaluation: RuleEvaluationResult;
  fallbackReason?:
    | 'no_api_key'
    | 'api_error'
    | 'rate_limited'
    | 'invalid_response'
    | 'backend_error';
}

export interface AiProvider {
  generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history?: AiMessage[]
  ): Promise<AiProviderResponse>;
}

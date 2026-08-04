export type DecisionType = 'Conforme' | 'Não Conforme' | 'Reprovado';

export type QueryIntent =
  | 'relato_afirmativo'
  | 'hipotese'
  | 'pergunta_informativa'
  | 'indefinida';

export type ConfidenceLevel = 'insuficiente' | 'baixa' | 'média' | 'alta';

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
    groups: RuleConditionGroup[];
  };
}

export interface DataRule {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  severity: DecisionType;
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
  matchPolicy?: RuleMatchPolicy;
}

export interface DataService {
  id: string;
  name: string;
  category: string;
  summary: string;
  /** Texto informativo legado; nunca é usado como fallback de decisão. */
  decisionDefault?: string;
  insights: string[];
  suggestedQuestions?: string[];
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
  severity: DecisionType;
  priority: number;
  /** Pontuação técnica de 0 a 10, usada apenas para ordenação. */
  score: number;
  factMatchQuality: number;
  specificity: number;
  relevance: number;
  matchReasons: string[];
  matchedTerms: string[];
  guidance?: string;
  message: string;
}

export interface EvaluationConflict {
  ruleIds: string[];
  decisions: DecisionType[];
  winnerRuleId: string;
  resolution: string;
}

export interface RuleEvaluationResult {
  serviceId: string;
  normalizedQuery: string;
  intent: QueryIntent;
  decision: DecisionType | null;
  hasSufficientEvidence: boolean;
  matchedRules: MatchedRule[];
  primaryRule: MatchedRule | null;
  conflicts: EvaluationConflict[];
  confidence: ConfidenceLevel;
  reasoningSummary: string;
  requiresHumanValidation: boolean;
  errorCode?: 'SERVICE_NOT_FOUND';
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

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  decision?: DecisionType;
}

export interface AiProviderResponse {
  content: string;
  provider: 'gemini' | 'simulated';
  decision: DecisionType | null;
  evaluation: RuleEvaluationResult;
}

export interface AiProvider {
  generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history?: AiMessage[]
  ): Promise<AiProviderResponse>;
}

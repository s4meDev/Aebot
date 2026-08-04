import type {
  DataRule,
  DataService,
  DecisionType,
  RuleConclusionMeta,
  RuleMatchPolicy,
  RuleStoreSchema,
} from '../types';

export const CURRENT_RULE_STORE_VERSION = '2.3.0';
const OFFICIAL_DECISIONS: DecisionType[] = ['Conforme', 'Não Conforme', 'Reprovado'];
type UnknownRecord = Record<string, unknown>;

export class RuleStoreValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Base de regras inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'RuleStoreValidationError';
  }
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function requiredString(
  source: UnknownRecord,
  key: string,
  path: string,
  issues: string[]
): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(`${path}.${key} deve ser texto não vazio`);
    return '';
  }
  return value.trim();
}

function requiredPositiveInteger(
  source: UnknownRecord,
  key: string,
  path: string,
  issues: string[]
): number {
  const value = source[key];
  if (!Number.isInteger(value) || (value as number) <= 0) {
    issues.push(`${path}.${key} deve ser inteiro positivo`);
    return 1;
  }
  return value as number;
}

function stringArray(
  value: unknown,
  path: string,
  issues: string[],
  required = false
): string[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    issues.push(`${path} deve ser uma lista de textos não vazios`);
    return required ? [] : undefined;
  }
  return value.map((item) => (item as string).trim());
}

function optionalString(
  source: UnknownRecord,
  key: string,
  path: string,
  issues: string[]
): string | undefined {
  if (source[key] === undefined) return undefined;
  return requiredString(source, key, path, issues) || undefined;
}

function parseMatchPolicy(
  value: unknown,
  path: string,
  issues: string[]
): RuleMatchPolicy | undefined {
  if (value === undefined) return undefined;
  const source = record(value);
  if (!source) {
    issues.push(`${path} deve ser objeto`);
    return undefined;
  }

  const allOf = stringArray(source.allOf, `${path}.allOf`, issues);
  let minimumGroups: RuleMatchPolicy['minimumGroups'];
  if (source.minimumGroups !== undefined) {
    const minimumSource = record(source.minimumGroups);
    if (!minimumSource) {
      issues.push(`${path}.minimumGroups deve ser objeto`);
    } else {
      const count = requiredPositiveInteger(minimumSource, 'count', `${path}.minimumGroups`, issues);
      const rawGroups = minimumSource.groups;
      if (!Array.isArray(rawGroups) || rawGroups.length === 0) {
        issues.push(`${path}.minimumGroups.groups deve conter ao menos um grupo`);
      } else {
        const groups = rawGroups.map((rawGroup, index) => {
          const groupPath = `${path}.minimumGroups.groups[${index}]`;
          const group = record(rawGroup);
          if (!group) {
            issues.push(`${groupPath} deve ser objeto`);
            return { label: '', expressions: [] };
          }
          const expressions = stringArray(group.expressions, `${groupPath}.expressions`, issues, true) ?? [];
          if (!expressions.length) issues.push(`${groupPath}.expressions não pode ser vazia`);
          return {
            label: requiredString(group, 'label', groupPath, issues),
            expressions,
          };
        });
        const labels = groups.map((group) => group.label).filter(Boolean);
        if (new Set(labels).size !== labels.length) {
          issues.push(`${path}.minimumGroups.groups possui labels duplicados`);
        }
        if (count > groups.length) {
          issues.push(`${path}.minimumGroups.count não pode exceder a quantidade de grupos`);
        }
        minimumGroups = {
          count,
          groups,
          positiveSignals: stringArray(
            minimumSource.positiveSignals,
            `${path}.minimumGroups.positiveSignals`,
            issues
          ),
          negativeSignals: stringArray(
            minimumSource.negativeSignals,
            `${path}.minimumGroups.negativeSignals`,
            issues
          ),
        };
      }
    }
  }
  return { allOf, minimumGroups };
}

function migrateLegacyStore(value: unknown): unknown {
  const source = record(value);
  if (!source || typeof source.version !== 'string' || !source.version.startsWith('1.')) {
    return value;
  }

  const conclusions = record(source.conclusions) ?? {};
  const officialConclusions = Object.fromEntries(
    OFFICIAL_DECISIONS.flatMap((decision) =>
      conclusions[decision] === undefined ? [] : [[decision, conclusions[decision]]]
    )
  );
  const services = Array.isArray(source.services)
    ? source.services.map((item) => {
        const service = record(item);
        if (!service) return item;
        const { decisionDefault: _legacyDefault, ...supported } = service;
        return supported;
      })
    : source.services;

  return {
    ...source,
    version: CURRENT_RULE_STORE_VERSION,
    conclusions: officialConclusions,
    services,
  };
}

export function parseRuleStore(value: unknown): RuleStoreSchema {
  const migrated = migrateLegacyStore(value);
  const source = record(migrated);
  if (!source) throw new RuleStoreValidationError(['raiz deve ser objeto']);

  const issues: string[] = [];
  const version = requiredString(source, 'version', 'store', issues);
  if (version && !/^2\.\d+\.\d+$/.test(version)) {
    issues.push(`store.version ${version} não é suportada`);
  }

  const rawConclusions = record(source.conclusions);
  const conclusions = {} as Record<DecisionType, RuleConclusionMeta>;
  if (!rawConclusions) {
    issues.push('store.conclusions deve ser objeto');
  }
  for (const decision of OFFICIAL_DECISIONS) {
    const path = `store.conclusions.${decision}`;
    const conclusion = record(rawConclusions?.[decision]);
    if (!conclusion) {
      issues.push(`${path} é obrigatório`);
      conclusions[decision] = { severity: decision, priority: 1, description: '' };
      continue;
    }
    const severity = requiredString(conclusion, 'severity', path, issues);
    if (severity !== decision) issues.push(`${path}.severity deve ser ${decision}`);
    conclusions[decision] = {
      severity: decision,
      priority: requiredPositiveInteger(conclusion, 'priority', path, issues),
      description: requiredString(conclusion, 'description', path, issues),
    };
  }
  for (const key of Object.keys(rawConclusions ?? {})) {
    if (!OFFICIAL_DECISIONS.includes(key as DecisionType)) {
      issues.push(`store.conclusions.${key} não é uma conclusão oficial`);
    }
  }
  if (
    conclusions.Reprovado.priority >= conclusions['Não Conforme'].priority ||
    conclusions['Não Conforme'].priority >= conclusions.Conforme.priority
  ) {
    issues.push('prioridades das conclusões devem respeitar Reprovado, Não Conforme e Conforme');
  }

  const rawServices = source.services;
  const services: DataService[] = Array.isArray(rawServices)
    ? rawServices.map((rawService, index) => {
        const path = `store.services[${index}]`;
        const service = record(rawService);
        if (!service) {
          issues.push(`${path} deve ser objeto`);
          return { id: '', name: '', category: '', summary: '', insights: [] };
        }
        return {
          id: requiredString(service, 'id', path, issues),
          name: requiredString(service, 'name', path, issues),
          category: requiredString(service, 'category', path, issues),
          summary: requiredString(service, 'summary', path, issues),
          insights: stringArray(service.insights, `${path}.insights`, issues, true) ?? [],
          suggestedQuestions: stringArray(
            service.suggestedQuestions,
            `${path}.suggestedQuestions`,
            issues
          ),
        };
      })
    : [];
  if (!Array.isArray(rawServices) || services.length === 0) {
    issues.push('store.services deve conter ao menos um serviço');
  }
  const serviceIds = new Set<string>();
  for (const service of services) {
    if (serviceIds.has(service.id)) issues.push(`serviceId duplicado: ${service.id}`);
    serviceIds.add(service.id);
  }

  const rawRules = source.rules;
  const rules: DataRule[] = Array.isArray(rawRules)
    ? rawRules.map((rawRule, index) => {
        const path = `store.rules[${index}]`;
        const item = record(rawRule);
        if (!item) {
          issues.push(`${path} deve ser objeto`);
          return {
            id: '', serviceId: '', title: '', description: '', severity: 'Conforme',
            priority: 1, conditionKeywords: [], message: '',
          };
        }
        const severityValue = requiredString(item, 'severity', path, issues);
        if (!OFFICIAL_DECISIONS.includes(severityValue as DecisionType)) {
          issues.push(`${path}.severity não é uma conclusão oficial`);
        }
        const parsedRule: DataRule = {
          id: requiredString(item, 'id', path, issues),
          serviceId: requiredString(item, 'serviceId', path, issues),
          title: requiredString(item, 'title', path, issues),
          description: requiredString(item, 'description', path, issues),
          severity: OFFICIAL_DECISIONS.includes(severityValue as DecisionType)
            ? severityValue as DecisionType
            : 'Conforme',
          priority: requiredPositiveInteger(item, 'priority', path, issues),
          conditionKeywords: stringArray(
            item.conditionKeywords,
            `${path}.conditionKeywords`,
            issues,
            true
          ) ?? [],
          message: requiredString(item, 'message', path, issues),
          equivalentExpressions: stringArray(item.equivalentExpressions, `${path}.equivalentExpressions`, issues),
          positiveSignals: stringArray(item.positiveSignals, `${path}.positiveSignals`, issues),
          negativeSignals: stringArray(item.negativeSignals, `${path}.negativeSignals`, issues),
          mandatoryConditions: stringArray(item.mandatoryConditions, `${path}.mandatoryConditions`, issues),
          exceptions: stringArray(item.exceptions, `${path}.exceptions`, issues),
          examples: stringArray(item.examples, `${path}.examples`, issues),
          guidance: optionalString(item, 'guidance', path, issues),
          category: optionalString(item, 'category', path, issues),
          relatedEvidence: stringArray(item.relatedEvidence, `${path}.relatedEvidence`, issues),
          topicKeywords: stringArray(item.topicKeywords, `${path}.topicKeywords`, issues),
          matchPolicy: parseMatchPolicy(item.matchPolicy, `${path}.matchPolicy`, issues),
        };
        const hasMatchingData =
          parsedRule.conditionKeywords.length > 0 ||
          Boolean(parsedRule.equivalentExpressions?.length) ||
          Boolean(parsedRule.matchPolicy?.allOf?.length) ||
          Boolean(parsedRule.matchPolicy?.minimumGroups) ||
          Boolean(parsedRule.positiveSignals?.length && parsedRule.relatedEvidence?.length);
        if (!hasMatchingData) issues.push(`${path} não possui condições de matching`);
        return parsedRule;
      })
    : [];
  if (!Array.isArray(rawRules)) issues.push('store.rules deve ser lista');

  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (ruleIds.has(rule.id)) issues.push(`ruleId duplicado: ${rule.id}`);
    ruleIds.add(rule.id);
    if (!serviceIds.has(rule.serviceId)) {
      issues.push(`regra ${rule.id} referencia serviço inexistente: ${rule.serviceId}`);
    }
  }

  if (issues.length) throw new RuleStoreValidationError(issues);
  return { version, conclusions, services, rules };
}

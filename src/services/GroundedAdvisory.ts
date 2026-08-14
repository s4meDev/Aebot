import type { DataService, GroundedAdvisory, MatchedRule } from '../types';

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Transforma regras próximas em uma orientação útil sem convertê-las em uma
 * conclusão oficial. A decisão continua dependendo de uma regra aplicável.
 */
export function buildGroundedAdvisory(
  service: DataService,
  relatedRules: MatchedRule[]
): GroundedAdvisory {
  const guidanceRule = relatedRules.find((rule) => rule.severity === null);
  const primaryRule = guidanceRule ?? relatedRules[0];

  if (!primaryRule) {
    const serviceGuidance = service.insights.slice(0, 2).join(' ');
    return {
      summary: `A dúvida está no contexto de ${service.name}, mas ainda não identifica um cenário classificatório específico.`,
      guidance: serviceGuidance || service.summary,
      basisRuleIds: [],
      missingInformation: [
        'Descreva o que as fotos mostram, o que não mostram e qual parametrização foi usada.',
      ],
    };
  }

  if (primaryRule.severity === null) {
    const summary = primaryRule.attentionLevel === 'critical'
      ? `Atenção crítica: ${primaryRule.message}`
      : primaryRule.message;
    return {
      summary,
      guidance: primaryRule.guidance ?? 'Compare o relato com as evidências da OS antes de classificar.',
      basisRuleIds: unique(relatedRules.map((rule) => rule.id)),
      missingInformation: [
        'Informe quais evidências foram apresentadas, quais faltaram e o que ficou executado ou pendente.',
      ],
    };
  }

  return {
    summary: `O relato se aproxima de ${primaryRule.id} — ${primaryRule.title}, mas ainda não confirma todas as condições dessa regra.`,
    guidance: 'Compare o fato relatado com as evidências e confirme se o cenário da regra realmente ocorreu antes de classificar a OS.',
    basisRuleIds: unique(relatedRules.map((rule) => rule.id)),
    missingInformation: [
      'Informe qual evidência comprova a ocorrência, a ausência ou a correção mencionada.',
    ],
  };
}

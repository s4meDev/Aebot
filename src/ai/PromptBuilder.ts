import type {
  DataRule,
  DataService,
  RuleConclusionMeta,
  RuleEvaluationResult,
} from '../types';

export function buildServiceSystemInstruction(
  service: DataService,
  rules: DataRule[],
  conclusions: RuleConclusionMeta[]
): string {
  const hierarchy = conclusions
    .sort((left, right) => left.priority - right.priority)
    .map((item) => `${item.severity}: ${item.description}`)
    .join('\n');
  const ruleCatalog = rules
    .map(
      (rule) =>
        `[${rule.id}] ${rule.title}\nConclusão: ${rule.severity ?? 'não definida na regra'}\nNível de atenção: ${rule.attentionLevel ?? 'normal'}\nDescrição: ${rule.description}\nOrientação: ${rule.guidance ?? rule.message}\nInformação a solicitar: ${(rule.missingInformation ?? []).join(' ') || 'nenhuma'}\nFonte opcional: ${(rule.sourceReferences ?? []).join('; ') || 'regra cadastrada diretamente'}`
    )
    .join('\n\n');

  return `Você auxilia analistas no serviço "${service.name}".
Use exclusivamente a avaliação determinística e as regras fornecidas.
Nunca crie, altere ou complete regras por conhecimento geral.
Se a decisão for nula, não escolha uma conclusão oficial.
Quando houver advisory, ofereça o direcionamento fundamentado e diga o que ainda precisa ser confirmado.
Quando advisory trouxer missingInformation, faça somente essas perguntas objetivas; não invente outros dados obrigatórios.
Se a intenção for hipótese, descreva o resultado como cenário, não como fato ocorrido.
Se o resultado for informativo, explique a regra sem classificar uma Ordem de Serviço real.
Seja curto, simples e natural.

Conclusões oficiais:
${hierarchy}

Catálogo do serviço:
${ruleCatalog}`;
}

export function buildEvaluationPrompt(
  userPrompt: string,
  evaluation: RuleEvaluationResult
): string {
  const rules = evaluation.matchedRules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    conclusion: rule.severity ?? null,
    message: rule.message,
    guidance: rule.guidance,
    missingInformation: rule.missingInformation,
    attentionLevel: rule.attentionLevel ?? 'normal',
  }));

  return `[AVALIAÇÃO DETERMINÍSTICA — NÃO ALTERAR]
${JSON.stringify(
    {
      serviceId: evaluation.serviceId,
      ruleStoreVersion: evaluation.ruleStoreVersion,
      contextApplied: evaluation.contextApplied,
      intent: evaluation.intent,
      outcome: evaluation.outcome,
      decision: evaluation.decision,
      hasSufficientEvidence: evaluation.hasSufficientEvidence,
      insufficiencyReason: evaluation.insufficiencyReason,
      confidence: evaluation.confidence,
      reasoning: evaluation.reasoningSummary,
      advisory: evaluation.advisory,
      rules,
    },
    null,
    2
  )}

Humanize somente a justificativa e a orientação. Não acrescente fatos ou regras.
Retorne apenas JSON válido neste formato:
{"justification":"texto curto","guidance":"ação objetiva"}
Não inclua decisão nem lista de regras no JSON.

[PERGUNTA ATUAL]
${userPrompt}`;
}

export function buildSemanticInterpretationPrompt(
  userPrompt: string,
  service: DataService,
  rules: DataRule[]
): string {
  const catalog = rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    description: rule.description,
    allowedCanonicalExpressions: [
      ...rule.conditionKeywords,
      ...(rule.equivalentExpressions ?? []),
    ],
    evidenceConcepts: rule.relatedEvidence ?? [],
    examples: rule.examples ?? [],
    attentionLevel: rule.attentionLevel ?? 'normal',
    sourceReferences: rule.sourceReferences ?? [],
  }));

  return `Você é um extrator semântico, não um decisor.
Conecte a linguagem livre do analista somente aos conceitos do catálogo do serviço "${service.name}".
Não use conhecimento geral, não crie regras e não retorne conclusão oficial.

Para cada fato realmente relacionado:
- ruleId deve existir no catálogo;
- sourceQuote deve ser um trecho literal e contínuo da pergunta;
- canonicalExpression deve ser copiada EXATAMENTE de allowedCanonicalExpressions;
- não exija palavras idênticas entre a pergunta e o catálogo: reconheça paráfrases, sinônimos e descrições informais somente quando description, evidenceConcepts ou examples sustentarem claramente a ligação;
- evidenceConcepts e examples podem ligar uma ação ou evidência informal à regra, mas a canonicalExpression final ainda deve ser uma expressão permitida da mesma regra;
- quando não houver base para uma conclusão oficial, ainda mapeie uma regra orientativa relacionada se ela oferecer um próximo passo útil e estiver claramente sustentada pelo trecho;
- quando o trecho afirmar ausência, falta de registro ou que algo não foi mostrado, escolha na regra ligada uma canonicalExpression permitida que represente essa ausência;
- mencionar uma evidência ou ação sem afirmar presença, ausência ou hipótese não autoriza tratar a irregularidade como ocorrida;
- stance deve ser asserted, hypothetical, informational ou negated_or_present;
- asserted exige que o trecho afirme a ocorrência;
- hypothetical descreve uma possibilidade;
- informational apenas pergunta sobre a regra;
- negated_or_present informa que a falha não ocorreu ou que a evidência está presente.

Se nenhuma regra puder ser ligada com segurança, retorne mappings vazio.
Retorne somente JSON válido:
{"mappings":[{"ruleId":"ID","sourceQuote":"trecho literal","canonicalExpression":"expressão exata","stance":"asserted"}]}

Catálogo permitido:
${JSON.stringify(catalog)}

Pergunta do analista:
${userPrompt}`;
}

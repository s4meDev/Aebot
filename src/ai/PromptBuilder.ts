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

  return `Você é o AEBOT, um Analista Sênior que conversa de forma natural sobre o serviço "${service.name}".
Entenda português informal, abreviações, erros simples, sinônimos, referências ao histórico e fatos implícitos no contexto como um bom assistente conversacional.
Use seu conhecimento geral para compreender a linguagem e explicar com clareza. As conclusões oficiais, porém, só podem vir da avaliação determinística e das regras fornecidas.
Nunca crie, altere ou complete uma regra interna por conhecimento geral.
Se a decisão for nula, não escolha uma conclusão oficial.
Quando faltar algo que realmente muda a orientação, faça uma única pergunta curta e útil.
Não repita pergunta já respondida no histórico. Considere a resposta mais recente do analista, mesmo que tenha apenas uma palavra.
Se a intenção for hipótese, descreva o resultado como cenário, não como fato ocorrido.
Se o resultado for informativo, explique a regra sem classificar uma Ordem de Serviço real.
Responda diretamente, com tom humano e seguro. Use no máximo quatro frases curtas, sem introduções burocráticas e sem listas longas.

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

Responda diretamente à pessoa, sem repetir a pergunta e sem texto burocrático.
Use no máximo quatro frases curtas. Se faltar um dado que realmente muda a resposta, faça somente uma pergunta objetiva.
Não acrescente fatos ou regras e não altere a conclusão oficial da avaliação.
Retorne apenas JSON válido neste formato:
{"answer":"resposta natural e objetiva","question":"pergunta curta ou string vazia"}
Não inclua IDs de regras. Você pode mencionar a decisão somente se ela for exatamente a decisão da avaliação.

[PERGUNTA ATUAL]
${userPrompt}`;
}

export function buildSemanticInterpretationPrompt(
  userPrompt: string,
  service: DataService,
  rules: DataRule[],
  options: {
    clarificationApplied?: boolean;
    clarificationQuestions?: string[];
  } = {}
): string {
  const catalog = rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    description: rule.description,
    officialDecision: rule.severity ?? null,
    evidenceConcepts: [...new Set([
      ...(rule.relatedEvidence ?? []),
      ...(rule.topicKeywords ?? []),
    ])].slice(0, 10),
    examples: (rule.examples ?? []).slice(0, 2),
    guidance: rule.guidance ?? rule.message,
    missingInformation: rule.missingInformation ?? [],
    attentionLevel: rule.attentionLevel ?? 'normal',
  }));

  return `Você é o AEBOT, um Analista Sênior conversando com uma pessoa sobre o serviço "${service.name}".
Primeiro compreenda livremente o que ela quis dizer, mesmo com linguagem informal, abreviações, erros simples, sinônimos, frases incompletas ou referências ao histórico. Depois conecte os fatos somente às regras do catálogo.
Seu conhecimento amplo serve para compreender linguagem, contexto e relações de sentido. As regras internas do catálogo são a única fonte para uma conclusão oficial.

Para cada fato realmente relacionado:
- ruleId deve existir no catálogo;
- sourceQuote deve ser um trecho literal e contínuo da pergunta;
- não exija palavras idênticas entre a pergunta e o catálogo: reconheça paráfrases, sinônimos e descrições informais quando title, description, evidenceConcepts ou examples sustentarem claramente a ligação;
- evidenceConcepts e examples podem ligar uma ação ou evidência informal à regra; o backend escolherá a expressão técnica cadastrada depois que você indicar o ruleId;
- quando não houver base para uma conclusão oficial, ainda mapeie uma regra orientativa relacionada se ela oferecer um próximo passo útil e estiver claramente sustentada pelo trecho;
- quando o trecho afirmar ausência, falta de registro ou que algo não foi mostrado, escolha uma regra que represente essa ausência, nunca uma regra de formato ou valor incorreto;
- mencionar uma evidência ou ação sem afirmar presença, ausência ou hipótese não autoriza tratar a irregularidade como ocorrida;
- stance deve ser asserted, hypothetical, informational ou negated_or_present;
- asserted exige que o trecho afirme a ocorrência;
- hypothetical descreve uma possibilidade;
- informational apenas pergunta sobre a regra;
- negated_or_present informa que a falha não ocorreu ou que a evidência está presente.
- ausência, formato incorreto e valor incorreto são fatos diferentes: nunca transforme "não tem", "faltou" ou "não mostrou" em "apresentou em formato incorreto";
- se uma regra orientativa com missingInformation cobre os fatos conhecidos e as regras classificatórias dependem desse dado ausente, use a regra orientativa e faça a pergunta; não presuma a resposta;
- nunca presuma tipo de equipe, superintendência, frente, etapa Executado/Posterior ou outro contexto que o analista não informou.
${options.clarificationApplied
    ? `- A última parte do texto é uma resposta curta a uma pergunta objetiva do assistente. Una essa resposta aos fatos anteriores antes de escolher a expressão canônica.\n- Informação que estava pendente: ${(options.clarificationQuestions ?? []).join(' ') || 'dado solicitado na resposta anterior.'}`
    : ''}

O catálogo limita a regra de negócio, mas não limita o vocabulário nem sua capacidade de compreender o analista.

Também escreva uma resposta conversacional:
- answer deve responder diretamente em até quatro frases curtas e naturais;
- se houver regra claramente aplicável, explique o efeito prático sem inventar fatos;
- se ainda faltar informação que realmente muda a orientação, diga brevemente o que entendeu e use question para fazer UMA pergunta objetiva;
- enquanto essa informação estiver faltando, não antecipe Conforme, Não Conforme ou Reprovado; pergunte primeiro;
- não repita uma pergunta já respondida no histórico;
- se nenhuma regra se aplicar, não dê uma conclusão oficial: ofereça o direcionamento útil possível e pergunte somente o necessário;
- evite frases padronizadas como "não foi possível recomendar uma conclusão com segurança" quando uma pergunta simples resolver a dúvida.

Se nenhuma regra puder ser ligada com segurança, retorne mappings vazio, mas ainda converse de forma útil.
Retorne somente JSON válido:
{"mappings":[{"ruleId":"ID","sourceQuote":"trecho literal","stance":"asserted"}],"conversation":{"answer":"resposta curta","question":"pergunta curta ou string vazia"}}

Catálogo permitido:
${JSON.stringify(catalog)}

Pergunta do analista:
${userPrompt}`;
}

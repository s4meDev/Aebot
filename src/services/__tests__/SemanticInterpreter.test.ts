import { describe, expect, it } from 'vitest';
import { ruleEngine } from '../RuleEngine';
import { parseSemanticInterpretation } from '../SemanticInterpreter';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);
const duringRule = rules.find((rule) => rule.conditionKeywords.includes('sem foto durante'))!;

function response(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    mappings: [{
      ruleId: duringRule.id,
      sourceQuote: 'não apareceu o momento do torque',
      canonicalExpression: 'sem foto durante',
      stance: 'asserted',
      ...overrides,
    }],
  });
}

describe('SemanticInterpreter', () => {
  it('recusa a pergunta inteira como prova quando ela mistura presença e ausência', () => {
    const query = 'Tem foto antes e depois, mas não mostrou o reparo sendo executado.';
    expect(parseSemanticInterpretation(JSON.stringify({ mappings: [{
      ruleId: duringRule.id, sourceQuote: query, stance: 'asserted',
    }] }), query, rules)).toBeNull();
    expect(parseSemanticInterpretation(JSON.stringify({ mappings: [{
      ruleId: duringRule.id, sourceQuote: 'não mostrou o reparo sendo executado', stance: 'asserted',
    }] }), query, rules)?.canonicalPrompt).toBe('sem foto durante');
  });
  it('não deixa o modelo escolher uma regra agregadora sem comprovar os fatos', () => {
    const aggregate = rules.find((rule) => rule.matchPolicy?.minimumMatchedFactGroups)!;
    expect(parseSemanticInterpretation(JSON.stringify({ mappings: [{
      ruleId: aggregate.id, sourceQuote: 'Não registraram como ficou no fim', stance: 'asserted',
    }] }), 'Não registraram como ficou no fim.', rules)).toBeNull();
  });

  it('fotografaram indica presença, não uma falta afirmada pelo modelo', () => {
    const before = rules.find((rule) => rule.conditionKeywords.includes('sem foto antes'))!;
    const result = parseSemanticInterpretation(JSON.stringify({ mappings: [{
      ruleId: before.id, sourceQuote: 'fotografaram antes de começar', stance: 'asserted',
    }] }), 'Só fotografaram antes de começar e no meio.', rules);
    expect(result?.canonicalPrompt).toBeNull();
    expect(result?.mappings[0].stance).toBe('negated_or_present');
  });
  it('aceita lista vazia como ausência semântica confirmada de correspondência', () => {
    expect(parseSemanticInterpretation(
      '{"mappings":[]}',
      'Situação fora do catálogo.',
      rules
    )).toEqual({ mappings: [], canonicalPrompt: null });
  });

  it('preserva uma resposta curta mesmo quando ainda não há regra segura', () => {
    const result = parseSemanticInterpretation(JSON.stringify({
      mappings: [],
      conversation: {
        answer: 'Entendi a dúvida, mas preciso confirmar um detalhe.',
        question: 'A equipe era interna ou terceirizada?',
      },
    }), 'deu problema no piso', rules);

    expect(result?.mappings).toEqual([]);
    expect(result?.conversation?.answer).toContain('preciso confirmar');
    expect(result?.conversation?.question).toBe('A equipe era interna ou terceirizada?');
  });

  it('aterra linguagem livre em uma expressão cadastrada', () => {
    const result = parseSemanticInterpretation(
      response(),
      'Não apareceu o momento do torque.',
      rules
    );

    expect(result?.canonicalPrompt).toBe('sem foto durante');
    expect(result?.mappings[0].ruleId).toBe(duringRule.id);
  });

  it('reconcilia citação sem acento com o trecho literal original', () => {
    const original = 'Ninguém registrou a execução do reparo.';
    const parsed = parseSemanticInterpretation(JSON.stringify({
      mappings: [{
        ruleId: duringRule.id,
        sourceQuote: 'ninguem registrou a execucao do reparo',
        canonicalExpression: 'não registrou a execução do reparo',
        stance: 'asserted',
      }],
    }), original, [duringRule]);

    expect(parsed?.mappings[0].sourceQuote).toBe('Ninguém registrou a execução do reparo');
  });

  it('reconcilia acentuação da expressão sem permitir conceito não cadastrado', () => {
    const result = parseSemanticInterpretation(JSON.stringify({
      mappings: [{
        ruleId: duringRule.id,
        sourceQuote: 'não registrou a execução do reparo',
        canonicalExpression: 'nao registrou a execucao do reparo',
        stance: 'asserted',
      }],
    }), 'Não registrou a execução do reparo.', [duringRule]);

    expect(result?.mappings[0].canonicalExpression)
      .toBe('não registrou a execução do reparo');
  });

  it('rejeita ruleId inexistente, expressão inventada e citação ausente', () => {
    expect(parseSemanticInterpretation(
      response({ ruleId: 'REGRA-INVENTADA' }),
      'Não apareceu o momento do torque.',
      rules
    )).toBeNull();
    expect(parseSemanticInterpretation(
      response({ canonicalExpression: 'reprovar livremente' }),
      'Não apareceu o momento do torque.',
      rules
    )).toBeNull();
    expect(parseSemanticInterpretation(
      response({ sourceQuote: 'trecho que não existe' }),
      'Não apareceu o momento do torque.',
      rules
    )).toBeNull();
    expect(parseSemanticInterpretation(
      response({ sourceQuote: 'torque' }),
      'Não apareceu o momento do torque.',
      rules
    )).toBeNull();
  });

  it('aceita uma resposta curta quando o modelo a relaciona ao contexto', () => {
    const internalRule = ruleEngine
      .getRulesForService('repavimentacao-calcada')
      .find((rule) => rule.id === 'RULE-PAV-AFERICAO-INTERNA-01')!;
    const raw = JSON.stringify({
      mappings: [{
        ruleId: internalRule.id,
        sourceQuote: 'interna',
        canonicalExpression: 'equipe interna sem aferição da vala',
        stance: 'asserted',
      }],
    });

    expect(parseSemanticInterpretation(
      raw,
      'interna',
      [internalRule]
    )?.canonicalPrompt).toBe('equipe interna sem aferição da vala');
    expect(parseSemanticInterpretation(
      raw,
      'interna',
      [internalRule],
      { allowSingleTokenQuote: true }
    )?.canonicalPrompt).toBe('equipe interna sem aferição da vala');
  });

  it('descarta mapeamento inválido sem perder outro mapeamento aterrado', () => {
    const result = parseSemanticInterpretation(JSON.stringify({
      mappings: [
        {
          ruleId: 'REGRA-INEXISTENTE',
          sourceQuote: 'não apareceu o momento do torque',
          canonicalExpression: 'regra inventada',
          stance: 'asserted',
        },
        {
          ruleId: duringRule.id,
          sourceQuote: 'não apareceu o momento do torque',
          canonicalExpression: 'sem foto durante',
          stance: 'asserted',
        },
      ],
    }), 'Não apareceu o momento do torque.', rules);

    expect(result?.mappings).toHaveLength(1);
    expect(result?.mappings[0].ruleId).toBe(duringRule.id);
  });

  it('preserva hipótese e pergunta informativa no prompt canônico', () => {
    const hypothetical = parseSemanticInterpretation(
      response({ stance: 'hypothetical' }),
      'Não apareceu o momento do torque.',
      rules
    );
    const informational = parseSemanticInterpretation(
      response({ stance: 'informational' }),
      'Não apareceu o momento do torque.',
      rules
    );

    expect(hypothetical?.canonicalPrompt).toBe('se sem foto durante');
    expect(informational?.canonicalPrompt).toBe('qual e a regra de sem foto durante');
  });

  it('corrige stance contraditório quando o trecho afirma ausência', () => {
    const result = parseSemanticInterpretation(
      response({ stance: 'negated_or_present' }),
      'Não apareceu o momento do torque.',
      rules
    );

    expect(result?.canonicalPrompt).toBe('sem foto durante');
    expect(result?.mappings[0].stance).toBe('asserted');
  });

  it('rejeita ausência associada a uma regra de formato incorreto', () => {
    const formatRule = ruleEngine
      .getRulesForService('repavimentacao-calcada')
      .find((rule) => rule.id === 'RULE-PAV-01')!;
    const result = parseSemanticInterpretation(JSON.stringify({
      mappings: [{
        ruleId: formatRule.id,
        sourceQuote: 'sem as medidas',
        stance: 'asserted',
      }],
      conversation: {
        answer: 'A medição está em formato incorreto.',
        question: '',
      },
    }), 'O piso ficou sem as medidas.', [formatRule]);

    expect(result).toBeNull();
  });
});

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
  it('aceita lista vazia como ausência semântica confirmada de correspondência', () => {
    expect(parseSemanticInterpretation(
      '{"mappings":[]}',
      'Situação fora do catálogo.',
      rules
    )).toEqual({ mappings: [], canonicalPrompt: null });
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

  it('não converte evidência presente em cenário irregular', () => {
    const result = parseSemanticInterpretation(
      response({ stance: 'negated_or_present' }),
      'Não apareceu o momento do torque.',
      rules
    );

    expect(result?.canonicalPrompt).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { DataRule } from '../../types';
import { ruleEngine } from '../RuleEngine';
import { selectSemanticRuleCandidates } from '../SemanticRuleRetriever';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);

describe('SemanticRuleRetriever', () => {
  it('prioriza conceitos relacionados sem decidir a conclusão', () => {
    const result = selectSemanticRuleCandidates(
      'não apareceu o torque aplicado na virola',
      rules,
      2
    );

    expect(result.strategy).toBe('ranked');
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].relatedEvidence).toContain('aperto da virola');
    expect(result.truncated).toBe(true);
  });

  it('mantém o catálogo completo quando cabe no limite', () => {
    const result = selectSemanticRuleCandidates('frase imprevisível', rules, rules.length);
    expect(result.strategy).toBe('complete');
    expect(result.rules).toEqual(rules);
    expect(result.truncated).toBe(false);
  });

  it('limita deterministicamente um catálogo grande sem correspondência', () => {
    const manyRules: DataRule[] = Array.from({ length: 30 }, (_, index) => ({
      ...rules[0],
      id: `generic-${String(index).padStart(2, '0')}`,
      title: `Assunto ${index}`,
      description: `Descrição ${index}`,
      conditionKeywords: [`condição ${index}`],
      topicKeywords: [],
      relatedEvidence: [],
    }));
    const result = selectSemanticRuleCandidates('vocabulário sem relação', manyRules, 8);

    expect(result.rules).toHaveLength(8);
    expect(result.strategy).toBe('limited');
    expect(result.truncated).toBe(true);
    expect(result.rules.map((rule) => rule.id)).toEqual(
      manyRules.slice(0, 8).map((rule) => rule.id)
    );
  });
});

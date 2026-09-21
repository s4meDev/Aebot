import { describe, expect, it } from 'vitest';
import type { DataRule } from '../../types';
import { ruleEngine } from '../RuleEngine';
import { selectSemanticRuleCandidates } from '../SemanticRuleRetriever';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);

describe('SemanticRuleRetriever', () => {
  it('não perde a regra da execução entre duas etapas presentes', () => {
    const result = selectSemanticRuleCandidates(
      'Tem foto antes e depois, mas não mostrou o reparo sendo executado.', rules, 6
    );
    const during = rules.find((rule) => rule.conditionKeywords.includes('sem foto durante'))!;
    expect(result.rules.map((rule) => rule.id)).toContain(during.id);
  });
  it('mantém a evidência final entre candidatos mesmo quando o início está presente', () => {
    const result = selectSemanticRuleCandidates(
      'Só fotografaram antes de começar e no meio. Não registraram como ficou no fim.', rules, 6
    );
    const finalRule = rules.find((rule) => rule.conditionKeywords.includes('sem foto depois'))!;
    expect(result.rules.map((rule) => rule.id)).toContain(finalRule.id);
  });
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

  it('prioriza ausência de medição sem confundir com formato incorreto', () => {
    const pavementRules = ruleEngine.getRulesForService('repavimentacao-calcada');
    const result = selectSemanticRuleCandidates(
      'o piso ficou sem as medidas, como fica isso?',
      pavementRules
    );

    expect(result.rules.map((rule) => rule.id)).toContain('RULE-PAV-AFERICAO-CONTEXTO-01');
    expect(result.rules.map((rule) => rule.id)).not.toContain('RULE-PAV-01');
  });

  it('mantém o catálogo completo quando cabe no limite', () => {
    const result = selectSemanticRuleCandidates('frase imprevisível', rules, rules.length);
    expect(result.strategy).toBe('complete');
    expect(result.rules).toEqual(rules);
    expect(result.truncated).toBe(false);
  });

  it('não corta o catálogo real quando a frase usa vocabulário imprevisível', () => {
    const result = selectSemanticRuleCandidates('xpto zuluquim', rules);

    expect(result.strategy).toBe('complete');
    expect(result.rules).toEqual(rules);
    expect(result.truncated).toBe(false);
  });

  it('mantém o catálogo inteiro quando não existe nenhuma pista lexical', () => {
    const manyRules: DataRule[] = Array.from({ length: 30 }, (_, index) => ({
      ...rules[0],
      id: `generic-${String(index).padStart(2, '0')}`,
      title: `Assunto ${index}`,
      description: `Descrição ${index}`,
      conditionKeywords: [`condição ${index}`],
      topicKeywords: [],
      relatedEvidence: [],
    }));
    const result = selectSemanticRuleCandidates('xpto zuluquim', manyRules, 8);

    expect(result.rules).toEqual(manyRules);
    expect(result.strategy).toBe('complete');
    expect(result.truncated).toBe(false);
  });

  it('reduz ruído quando há pistas lexicais suficientes', () => {
    const manyRules: DataRule[] = Array.from({ length: 30 }, (_, index) => ({
      ...rules[0],
      id: `generic-${String(index).padStart(2, '0')}`,
      title: `Assunto ${index}`,
      description: `Descrição específica ${index}`,
      conditionKeywords: [`condição específica ${index}`],
      topicKeywords: [],
      relatedEvidence: [],
    }));
    const result = selectSemanticRuleCandidates('assunto específico 2', manyRules, 8);

    expect(result.rules).toHaveLength(8);
    expect(result.strategy).toBe('ranked');
    expect(result.truncated).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import regressionCases from '../../data/regressionCases.json';
import type {
  DecisionType,
  EvaluationOutcome,
  InsufficiencyReason,
  QueryIntent,
} from '../../types';
import { ruleEngine } from '../RuleEngine';

interface RegressionCase {
  name: string;
  serviceId: string;
  query: string;
  intent: QueryIntent;
  outcome: EvaluationOutcome;
  insufficiencyReason?: InsufficiencyReason;
  decision: DecisionType | null;
  minimumMatches: number;
  maximumMatches?: number;
}

describe('corpus de regressão do motor', () => {
  it.each(regressionCases as RegressionCase[])('$name', (testCase) => {
    const result = ruleEngine.evaluatePrompt(testCase.query, testCase.serviceId);

    expect(result.intent).toBe(testCase.intent);
    expect(result.contextApplied).toBe(false);
    expect(result.outcome).toBe(testCase.outcome);
    if (testCase.insufficiencyReason) {
      expect(result.insufficiencyReason).toBe(testCase.insufficiencyReason);
    }
    expect(result.decision).toBe(testCase.decision);
    expect(result.matchedRules.length).toBeGreaterThanOrEqual(testCase.minimumMatches);
    if (testCase.maximumMatches !== undefined) {
      expect(result.matchedRules.length).toBeLessThanOrEqual(testCase.maximumMatches);
    }
    expect(result.hasSufficientEvidence).toBe(testCase.decision !== null);
    expect(result.requiresHumanValidation).toBe(
      testCase.outcome === 'insufficient' || testCase.outcome === 'advisory'
    );
    expect(result.ruleStoreVersion).toMatch(/^2\./);

    if (result.outcome === 'insufficient') {
      expect(result.primaryRule).toBeNull();
      expect(result.confidence).toBe('insuficiente');
    } else if (result.outcome === 'decision') {
      expect(result.primaryRule).toBe(result.matchedRules[0]);
      expect(result.confidence).not.toBe('insuficiente');
    } else if (result.outcome === 'advisory') {
      expect(result.primaryRule).toBe(result.matchedRules[0]);
      expect(result.advisory).toBeDefined();
      expect(result.decision).toBeNull();
      expect(result.confidence).not.toBe('insuficiente');
    } else {
      expect(result.decision).toBeNull();
      expect(result.confidence).not.toBe('insuficiente');
    }

    if (result.matchedRules.length) {
      for (const rule of result.matchedRules) {
        expect(rule.id).not.toBe('');
        expect(rule.title).not.toBe('');
        expect(rule.score).toBeGreaterThanOrEqual(0);
        expect(rule.score).toBeLessThanOrEqual(10);
        expect(rule.matchReasons.length).toBeGreaterThan(0);
        expect(rule.matchedTerms.length).toBeGreaterThan(0);
      }
    }
  });
});

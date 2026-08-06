import { describe, expect, it } from 'vitest';
import { ruleEngine } from '../../src/services/RuleEngine';

const capacityIt = process.env.AEBOT_RUN_CAPACITY === 'true' ? it : it.skip;

describe('capacidade determinística isolada', () => {
  capacityIt('processa um lote equivalente a 3.000 OS sem chamar IA', () => {
    // O limite representa 50 avaliações/s. Este arquivo é executado sozinho
    // por `npm run test:capacity`, sem competir com os demais workers do Vitest.
    const maximumBatchDurationMs = 60_000;
    const serviceId = ruleEngine.getServices()[0]?.id;
    expect(serviceId).toBeTruthy();
    const startedAt = performance.now();
    let decisions = 0;
    for (let index = 0; index < 3_000; index += 1) {
      const result = ruleEngine.evaluatePrompt('sem foto depois', serviceId!);
      if (result.decision === 'Reprovado') decisions += 1;
    }
    const elapsedMs = performance.now() - startedAt;

    expect(decisions).toBe(3_000);
    expect(elapsedMs).toBeLessThan(maximumBatchDurationMs);
  }, 65_000);
});

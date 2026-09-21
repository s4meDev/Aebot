import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalData } from '../LocalData';
import { ruleEngine } from '../../src/services/RuleEngine';
describe('persistência local', () => {
  it('contadores sobrevivem à reinicialização sem gravar conversas', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-metrics-test-'));
    const data = new LocalData(directory);
    await data.record({ content: 'resposta privada', provider: 'local', decision: null,
      evaluation: ruleEngine.evaluatePrompt('pergunta privada', 'reparo-cavalete'),
      modelAttempts: [{ provider: 'local', model: 'Qwen', status: 'ok', durationMs: 10 }] }, 123);
    const text = await readFile(path.join(directory, 'metrics.json'), 'utf8');
    expect(text).not.toContain('privada');
    const restored = new LocalData(directory); await restored.load();
    expect(restored.summary).toMatchObject({ analyses: 1, modelCalls: 1, durationMs: 123 });
    const id = await restored.saveFeedback({ serviceId: 'reparo-cavalete', appVersion: '2.18.0',
      category: 'sugestao', message: 'Feedback enviado voluntariamente.' });
    const again = new LocalData(directory); await again.load();
    expect(again.report().feedback[0].id).toBe(id);
  });
});

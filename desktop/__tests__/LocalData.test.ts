import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalData } from '../LocalData';
import { ruleEngine } from '../../src/services/RuleEngine';
describe('persistência local', () => {
  it('não sobrescreve feedback danificado e avisa no relatório', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-recovery-test-'));
    const file = path.join(directory, 'feedback.json');
    await writeFile(file, '{incompleto');
    const data = new LocalData(directory); await data.load();
    await expect(data.saveFeedback({ serviceId: 'reparo-cavalete', appVersion: '2.18.0',
      category: 'sugestao', message: 'Nova sugestão do analista.' })).rejects.toThrow('recuperação');
    expect(await readFile(file, 'utf8')).toBe('{incompleto');
    expect(data.report().feedbackWarning).toContain('incompleto');
  });
  it('preserva envios simultâneos de feedback', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-feedback-test-'));
    const data = new LocalData(directory);
    const input = { serviceId: 'reparo-cavalete', appVersion: '2.18.0',
      category: 'sugestao' as const, message: 'Sugestão enviada voluntariamente.' };
    const ids = await Promise.all([data.saveFeedback(input), data.saveFeedback(input)]);
    const restored = new LocalData(directory); await restored.load();
    expect(restored.report().feedback.map((item) => item.id)).toEqual(ids);
  });
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

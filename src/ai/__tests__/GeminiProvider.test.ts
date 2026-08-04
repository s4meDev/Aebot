import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildEvaluationPrompt } from '../PromptBuilder';
import { buildGeminiContents, GeminiProvider } from '../GeminiProvider';
import { ruleEngine } from '../../services/RuleEngine';
import { storageAdapter } from '../../storage/StorageAdapter';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import type { AiMessage } from '../../types';

const selectedService = ruleEngine.getServices()[0];

describe('GeminiProvider', () => {
  it('não envia a pergunta atual duplicada no histórico e no prompt', () => {
    const current = 'A foto depois não foi apresentada.';
    const history: AiMessage[] = [
      { id: 'old', role: 'assistant', content: 'Resposta anterior', timestamp: '10:00' },
      { id: 'current', role: 'user', content: current, timestamp: '10:01' },
    ];
    const evaluation = ruleEngine.evaluatePrompt(current, selectedService.id);
    const augmented = buildEvaluationPrompt(current, evaluation);
    const contents = buildGeminiContents(history, current, augmented);
    const serialized = JSON.stringify(contents);

    expect(serialized.split(current).length - 1).toBe(1);
    expect(contents).toHaveLength(2);
  });

  it('modo simulado não aprova quando nenhuma regra é encontrada', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const provider = new GeminiProvider();
    const response = await provider.generateResponse(
      '',
      'A equipe chegou cedo ao endereço.',
      { id: selectedService.id, name: selectedService.name }
    );

    expect(response.provider).toBe('simulated');
    expect(response.decision).toBeNull();
    expect(response.content).toContain('Não foi possível recomendar uma conclusão');
  });

  it('ausência de regra permanece decision null no contrato do provider', async () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    const response = await new GeminiProvider().generateResponse(
      '',
      'Dúvida sem relação com as regras cadastradas.',
      { id: selectedService.id, name: selectedService.name }
    );
    expect(response.evaluation.hasSufficientEvidence).toBe(false);
    expect(response.evaluation.decision).toBeNull();
    expect(response.decision).toBeNull();
  });

  it('motor genérico não contém IDs nem textos de um serviço específico', () => {
    const files = ['../../services/RuleEngine.ts', '../../services/RuleRetriever.ts', '../../services/ConflictResolver.ts'];
    const source = files
      .map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/RULE-RC/i);
    expect(source).not.toMatch(/Reparo de Cavalete/i);
  });
});

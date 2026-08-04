import type {
  AiMessage,
  AiProvider,
  AiProviderResponse,
  DecisionType,
  RuleEvaluationResult,
  ServiceIdentity,
} from '../types';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../localConfig';
import { ruleEngine, type RuleEngine } from '../services/RuleEngine';
import {
  formatEvaluationResponse,
  type ResponseNarrative,
} from '../services/ResponseFormatter';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { buildEvaluationPrompt } from './PromptBuilder';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function buildGeminiContents(
  history: AiMessage[],
  currentPrompt: string,
  augmentedPrompt: string
): GeminiContent[] {
  const relevantHistory = history.filter((message) => message.id !== 'welcome');
  const lastMessage = relevantHistory[relevantHistory.length - 1];
  const historyWithoutCurrent =
    lastMessage?.role === 'user' && lastMessage.content.trim() === currentPrompt.trim()
      ? relevantHistory.slice(0, -1)
      : relevantHistory;

  const formattedHistory: GeminiContent[] = historyWithoutCurrent.slice(-6).map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.content }],
  }));

  return [...formattedHistory, { role: 'user', parts: [{ text: augmentedPrompt }] }];
}

function mentionsDecision(text: string): DecisionType[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  return [
    normalized.includes('nao conforme') ? 'Não Conforme' : null,
    normalized.includes('reprovado') ? 'Reprovado' : null,
    /(^|\s)conforme($|\s)/.test(normalized.replace(/nao conforme/g, '')) ? 'Conforme' : null,
  ].filter((decision): decision is DecisionType => decision !== null);
}

function parseNarrative(text: string, evaluation: RuleEvaluationResult): ResponseNarrative | null {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    if (typeof parsed.justification !== 'string' || typeof parsed.guidance !== 'string') return null;
    if (parsed.justification.length > 500 || parsed.guidance.length > 300) return null;

    const combined = `${parsed.justification} ${parsed.guidance}`;
    const decisions = mentionsDecision(combined);
    if (decisions.some((decision) => decision !== evaluation.decision)) return null;

    const mentionedRuleIds = combined.match(/RULE-[A-Z0-9-]+/gi) ?? [];
    const knownRuleIds = new Set(evaluation.matchedRules.map((rule) => rule.id.toUpperCase()));
    if (mentionedRuleIds.some((id) => !knownRuleIds.has(id.toUpperCase()))) return null;

    return { justification: parsed.justification.trim(), guidance: parsed.guidance.trim() };
  } catch {
    return null;
  }
}

export class GeminiProvider implements AiProvider {
  constructor(private readonly engine: RuleEngine = ruleEngine) {}

  async generateResponse(
    context: string,
    prompt: string,
    service: ServiceIdentity,
    history: AiMessage[] = []
  ): Promise<AiProviderResponse> {
    const evaluation = this.engine.evaluatePrompt(prompt, service.id);
    const customKey = storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '');
    const apiKey = (customKey.trim() || GEMINI_API_KEY || '').trim();
    const selectedModel = storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, GEMINI_MODEL);

    if (apiKey) {
      try {
        const augmentedPrompt = buildEvaluationPrompt(prompt, evaluation);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: buildGeminiContents(history, prompt, augmentedPrompt),
              systemInstruction: { parts: [{ text: context }] },
              generationConfig: {
                temperature: 0.05,
                topK: 10,
                topP: 0.85,
                maxOutputTokens: 512,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const narrative = typeof text === 'string' ? parseNarrative(text, evaluation) : null;
          if (narrative) {
            return {
              provider: 'gemini',
              content: formatEvaluationResponse(evaluation, narrative),
              decision: evaluation.decision,
              evaluation,
            };
          }
        }
      } catch (error) {
        console.warn('Erro ao chamar API do Gemini:', error);
      }
    }

    return {
      provider: 'simulated',
      content: formatEvaluationResponse(evaluation),
      decision: evaluation.decision,
      evaluation,
    };
  }
}

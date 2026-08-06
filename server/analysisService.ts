import { GeminiModelClient } from '../src/ai/GeminiProvider';
import { OllamaModelClient } from '../src/ai/OllamaModelClient';
import {
  FallbackStructuredModelClient,
  type StructuredModelClient,
} from '../src/ai/StructuredModelClient';
import {
  AebotAnalysisService as SharedAnalysisService,
  type AnalysisService,
} from '../src/services/AnalysisService';
import type { RuleEngine } from '../src/services/RuleEngine';
import type { ServerConfig } from './config';

export type { AnalysisService } from '../src/services/AnalysisService';

function createModelClient(config: ServerConfig): StructuredModelClient | null {
  const gemini = config.geminiApiKey
    ? new GeminiModelClient(
        config.geminiApiKey,
        config.geminiModel,
        config.geminiFallbackModel
      )
    : null;
  const ollama = config.ollamaModel
    ? new OllamaModelClient(config.ollamaBaseUrl, config.ollamaModel)
    : null;

  if (config.aiProvider === 'gemini') return gemini;
  if (config.aiProvider === 'ollama') return ollama;
  if (ollama && gemini) return new FallbackStructuredModelClient(ollama, gemini);
  return ollama ?? gemini;
}

/** Adaptador de configuração para o servidor Node local/de contingência. */
export class AebotAnalysisService extends SharedAnalysisService implements AnalysisService {
  constructor(config: ServerConfig, engine?: RuleEngine) {
    super({
      modelClient: createModelClient(config),
      humanizeDeterministicResponses: config.humanizeDeterministicResponses,
      geminiConfigured: Boolean(config.geminiApiKey),
    }, engine);
  }
}

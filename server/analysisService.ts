import { GeminiProvider } from '../src/ai/GeminiProvider';
import { buildServiceSystemInstruction } from '../src/ai/PromptBuilder';
import { ruleEngine, type RuleEngine } from '../src/services/RuleEngine';
import type { AiProviderResponse, DataService } from '../src/types';
import type { AnalyzeRequest } from './contracts';
import type { ServerConfig } from './config';

export interface AnalysisService {
  analyze(request: AnalyzeRequest): Promise<AiProviderResponse>;
  listServices(): Array<DataService & { ruleCount: number }>;
  status(): { ruleStoreVersion: string; geminiConfigured: boolean };
}

export class AebotAnalysisService implements AnalysisService {
  private readonly provider: GeminiProvider;

  constructor(
    private readonly config: ServerConfig,
    private readonly engine: RuleEngine = ruleEngine
  ) {
    this.provider = new GeminiProvider(engine, {
      getApiKey: () => this.config.geminiApiKey,
      getModel: () => this.config.geminiModel,
    });
  }

  async analyze(request: AnalyzeRequest): Promise<AiProviderResponse> {
    const service = this.engine.getServices().find((item) => item.id === request.serviceId);
    const context = service
      ? buildServiceSystemInstruction(
          service,
          this.engine.getRulesForService(service.id),
          this.engine.getConclusions()
        )
      : '';
    return this.provider.generateResponse(
      context,
      request.prompt,
      { id: request.serviceId, name: service?.name ?? request.serviceId },
      request.history
    );
  }

  listServices(): Array<DataService & { ruleCount: number }> {
    return this.engine.getServices().map((service) => ({
      ...service,
      ruleCount: this.engine.getRulesForService(service.id).length,
    }));
  }

  status(): { ruleStoreVersion: string; geminiConfigured: boolean } {
    return {
      ruleStoreVersion: this.engine.getRuleStoreVersion(),
      geminiConfigured: Boolean(this.config.geminiApiKey),
    };
  }
}

import { GeminiProvider } from '../ai/GeminiProvider';
import { buildServiceSystemInstruction } from '../ai/PromptBuilder';
import type {
  StructuredModelClient,
  StructuredModelProvider,
} from '../ai/StructuredModelClient';
import type {
  AiProviderResponse,
  AnalysisRequest,
  DataService,
} from '../types';
import { ruleEngine, type RuleEngine } from './RuleEngine';

export interface AnalysisStatus {
  ruleStoreVersion: string;
  aiConfigured: boolean;
  aiProvider: StructuredModelProvider | 'none';
  aiProviders: StructuredModelProvider[];
  geminiConfigured: boolean;
  serviceCount?: number;
  ruleCount?: number;
  aiMetrics?: ReturnType<GeminiProvider['getDiagnostics']>;
}

export interface AnalysisService {
  analyze(request: AnalysisRequest): Promise<AiProviderResponse>;
  listServices(): Array<DataService & { ruleCount: number }>;
  status(): AnalysisStatus;
}

export interface AnalysisServiceOptions {
  modelClient: StructuredModelClient | null;
  humanizeDeterministicResponses?: boolean;
  geminiConfigured?: boolean;
}

/** Usa o mesmo motor na extensão, no servidor local e no Worker online. */
export class AebotAnalysisService implements AnalysisService {
  private readonly provider: GeminiProvider;

  constructor(
    private readonly options: AnalysisServiceOptions,
    private readonly engine: RuleEngine = ruleEngine
  ) {
    this.provider = new GeminiProvider(engine, {
      getModelClient: () => this.options.modelClient,
      humanizeDeterministicResponses: this.options.humanizeDeterministicResponses,
    });
  }

  async analyze(request: AnalysisRequest): Promise<AiProviderResponse> {
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

  status(): AnalysisStatus {
    return {
      ruleStoreVersion: this.engine.getRuleStoreVersion(),
      aiConfigured: Boolean(this.options.modelClient),
      aiProvider: this.options.modelClient?.provider ?? 'none',
      aiProviders: [...(this.options.modelClient?.providerChain ?? [])],
      geminiConfigured: Boolean(this.options.geminiConfigured),
      serviceCount: this.engine.getServices().length,
      ruleCount: this.engine.getServices().reduce(
        (total, service) => total + this.engine.getRulesForService(service.id).length,
        0
      ),
      aiMetrics: this.provider.getDiagnostics(),
    };
  }
}

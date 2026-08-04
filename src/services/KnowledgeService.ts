import type { ServiceRecord, ServiceRepositoryResult } from '../types';
import { serviceRepository } from '../repositories/serviceRepository';
import { ruleEngine } from './RuleEngine';
import { buildServiceSystemInstruction } from '../ai/PromptBuilder';

export class KnowledgeService {
  constructor(private readonly repository: typeof serviceRepository) {}

  async loadServices(): Promise<ServiceRepositoryResult> {
    try {
      const result = await this.repository.getAll();
      if (!result.services?.length) {
        return { type: 'error', message: 'Nenhum serviço encontrado.' };
      }
      return result;
    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao carregar informações do serviço.',
      };
    }
  }

  getServiceContext(service: ServiceRecord): string {
    return buildServiceSystemInstruction(
      service,
      ruleEngine.getRulesForService(service.id),
      ruleEngine.getConclusions()
    );
  }
}

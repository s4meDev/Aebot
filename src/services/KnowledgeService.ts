import type { ServiceRecord } from '../types';
import { ruleEngine } from './RuleEngine';
import { buildServiceSystemInstruction } from '../ai/PromptBuilder';

export class KnowledgeService {
  getServiceContext(service: ServiceRecord): string {
    return buildServiceSystemInstruction(
      service,
      ruleEngine.getRulesForService(service.id),
      ruleEngine.getConclusions()
    );
  }
}

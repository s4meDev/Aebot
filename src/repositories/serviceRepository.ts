import type { ServiceRecord, ServiceRepositoryResult } from '../types';
import { ruleEngine } from '../services/RuleEngine';

export const serviceRepository = {
  async getAll(): Promise<ServiceRepositoryResult> {
    const dataServices = ruleEngine.getServices();

    const services: ServiceRecord[] = dataServices.map((svc) => ({
      ...svc,
      businessRules: ruleEngine.getRulesForService(svc.id),
    }));

    return { type: 'success', services };
  },
};

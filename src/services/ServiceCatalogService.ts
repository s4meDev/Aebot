import type { ServiceCatalogResult, ServiceRecord } from '../types';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { storageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { serviceRepository } from '../repositories/serviceRepository';
import { checkBackendAccess, resolveBackendUrl } from '../ai/BackendClient';

interface CatalogDependencies {
  repository?: typeof serviceRepository;
  storage?: StorageAdapter;
}

/** Prefere o catálogo central e explica claramente quando mostra a cópia local. */
export class ServiceCatalogService {
  private readonly repository: typeof serviceRepository;
  private readonly storage: StorageAdapter;

  constructor(dependencies: CatalogDependencies = {}) {
    this.repository = dependencies.repository ?? serviceRepository;
    this.storage = dependencies.storage ?? storageAdapter;
  }

  async load(): Promise<ServiceCatalogResult> {
    const local = await this.repository.getAll();
    if (local.type !== 'success' || !local.services?.length) {
      return { type: 'error', message: local.message ?? 'Nenhum serviço encontrado.' };
    }

    const configuredBackendUrl = this.storage.get<string>(STORAGE_KEYS.BACKEND_URL, '');
    const backendUrl = resolveBackendUrl(configuredBackendUrl);
    if (!backendUrl.trim()) {
      this.storage.remove(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION);
      return { type: 'success', services: local.services, source: 'local' };
    }

    const token = this.storage.get<string>(STORAGE_KEYS.BACKEND_TOKEN, '');
    const access = await checkBackendAccess(backendUrl, token);
    if (access.state !== 'online') {
      if (access.state === 'offline' && access.health) {
        this.storage.set(
          STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
          access.health.ruleStoreVersion
        );
      }
      return {
        type: 'success',
        services: local.services,
        source: 'local',
        ruleStoreVersion: access.state === 'offline'
          ? access.health?.ruleStoreVersion
          : undefined,
        warning: access.state === 'offline'
          ? `${access.message} Usando o catálogo local como contingência.`
          : 'Backend não configurado. Usando o catálogo local.',
      };
    }

    const ruleStoreVersion = access.catalog.ruleStoreVersion;
    this.storage.set(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION, ruleStoreVersion);
    const localById = new Map(local.services.map((service) => [service.id, service]));
    const services: ServiceRecord[] = access.catalog.services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      summary: service.summary,
      insights: service.insights,
      suggestedQuestions: service.suggestedQuestions,
      businessRules: localById.get(service.id)?.businessRules ?? [],
    }));

    return {
      type: 'success',
      services,
      source: 'backend',
      ruleStoreVersion,
    };
  }
}

export const serviceCatalogService = new ServiceCatalogService();

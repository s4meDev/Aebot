import type { DataService, ServiceParameterization } from '../types';
import { findExpressions, type NormalizedText } from './TextNormalizer';

export type ParameterizationType = keyof ServiceParameterization;

const LABELS: Record<ParameterizationType, string> = {
  serviceExchange: 'Troca de Serviço',
  executedAdditional: 'Adicional Executado',
  subsequentAdditional: 'Adicional Posterior',
};

function requestedTypes(query: NormalizedText): ParameterizationType[] {
  const has = (...markers: string[]) => findExpressions(query, markers).length > 0;
  const asksAboutParameterization = [
    'parametrizacao',
    'parametrizacoes',
    'servico parametrizado',
    'servicos parametrizados',
    'troca',
    'trocas',
    'troca de servico',
    'adicional',
    'adicionais',
    'desdobro',
    'desdobros',
    'servicos disponiveis',
    'opcoes de servico',
  ].some((marker) => has(marker));
  if (!asksAboutParameterization) return [];

  if (has(
    'parametrizacao',
    'parametrizacoes',
    'servico parametrizado',
    'servicos parametrizados',
    'servicos disponiveis'
  )) {
    return ['serviceExchange', 'executedAdditional', 'subsequentAdditional'];
  }

  const result: ParameterizationType[] = [];
  if (has('troca', 'trocas')) result.push('serviceExchange');
  if (has('executado', 'executados')) result.push('executedAdditional');
  if (has('posterior', 'posteriores')) result.push('subsequentAdditional');
  if (has('adicional', 'adicionais', 'desdobro', 'desdobros') && result.length === 0) {
    result.push('executedAdditional', 'subsequentAdditional');
  }
  return result;
}

/** Responde somente com relações cadastradas; não calcula conclusão da OS. */
export function describeServiceParameterization(
  query: NormalizedText,
  service: DataService,
  services: DataService[]
): string | null {
  const types = requestedTypes(query);
  if (!types.length || !service.parameterization) return null;

  const servicesById = new Map(services.map((item) => [item.id, item.name]));
  const sections = types.flatMap((type) => {
    const ids = service.parameterization?.[type] ?? [];
    if (!ids.length) return [];
    const names = ids.map((id) => servicesById.get(id) ?? id);
    return [`${LABELS[type]}: ${names.join('; ')}.`];
  });
  return sections.length ? sections.join('\n') : null;
}

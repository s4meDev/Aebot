import React from 'react';
import type { ServiceRecord } from '../types';

interface ServiceDetailsProps {
  service: ServiceRecord;
  services: ServiceRecord[];
}

const parameterizationLabels = {
  serviceExchange: 'Troca de Serviço',
  executedAdditional: 'Adicional Executado',
  subsequentAdditional: 'Adicional Posterior',
} as const;

export const ServiceDetails: React.FC<ServiceDetailsProps> = ({ service, services }) => {
  const servicesById = new Map(services.map((item) => [item.id, item]));
  const parameterizationGroups = Object.entries(service.parameterization ?? {})
    .filter((entry): entry is [keyof typeof parameterizationLabels, string[]] => (
      entry[0] in parameterizationLabels && Array.isArray(entry[1]) && entry[1].length > 0
    ));

  return (
    <div className="card service-details-card">
      <div className="service-header">
        <div>
          <span className="eyebrow-inline">{service.category}</span>
          <h2 className="service-title">{service.name}</h2>
        </div>
      </div>

      <p className="service-summary">{service.summary}</p>

      {service.analysisStatus === 'rules_pending' && (
        <div className="service-pending-notice">
          Este serviço já pode ser uma OS original, mas a análise ficará sem decisão até que suas regras próprias sejam cadastradas.
        </div>
      )}

      {service.catalogNameStatus === 'needs_confirmation' && (
        <div className="service-name-notice">
          Nome reconstruído a partir de uma captura cortada. Rótulo visível: {service.sourceLabel}
        </div>
      )}

      {parameterizationGroups.length > 0 && (
        <details className="insights-container parameterization-container">
          <summary className="insights-summary">
            <span>Parametrização do sistema</span>
            <span className="insights-count">
              {parameterizationGroups.reduce((total, [, ids]) => total + ids.length, 0)}
            </span>
          </summary>
          <div className="parameterization-groups">
            {parameterizationGroups.map(([type, ids]) => (
              <section key={type} className="parameterization-group">
                <h3>{parameterizationLabels[type]}</h3>
                <ul>
                  {ids.map((id) => {
                    const target = servicesById.get(id);
                    return (
                      <li key={id}>
                        {target?.name ?? `Serviço não encontrado (${id})`}
                        {target?.catalogNameStatus === 'needs_confirmation' && ' *'}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="parameterization-help">
              Adicional também pode ser chamado de desdobro. Cada item desta lista possui cadastro próprio e pode ser o serviço original de outra OS.
              {' '}O asterisco indica nome ainda dependente de confirmação porque a captura original estava cortada.
            </p>
          </div>
        </details>
      )}

      <details className="insights-container">
        <summary className="insights-summary">
          <span>Regras e diretrizes</span>
          <span className="insights-count">{service.insights.length}</span>
        </summary>
        <ul className="insights-list">
          {service.insights.map((insight) => (
            <li key={insight} className="insight-item">
              <span className="insight-bullet"></span>
              <span className="insight-text">{insight}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

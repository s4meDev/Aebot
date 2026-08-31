import React from 'react';
import type { ServiceRecord } from '../types';

interface ServiceSelectorProps {
  services: ServiceRecord[];
  selectedServiceId: string;
  onSelect: (id: string) => void;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  services,
  selectedServiceId,
  onSelect,
}) => {
  const selectedServiceExists = services.some((service) => service.id === selectedServiceId);
  const selectedService = services.find((service) => service.id === selectedServiceId);

  return (
    <div className="service-selector-card">
      <span className="selector-index" aria-hidden="true">01</span>
      <div className="selector-content">
        <label htmlFor="service-dropdown" className="selector-label">
          Serviço em análise
        </label>
        <div className="select-wrap">
          <select
            id="service-dropdown"
            className="select-control service-select"
            value={selectedServiceId}
            onChange={(e) => onSelect(e.target.value)}
          >
            {!selectedServiceExists && (
              <option value={selectedServiceId} disabled>
                {selectedServiceId ? 'Serviço salvo não encontrado' : 'Selecione um serviço'}
              </option>
            )}
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name}{svc.analysisStatus === 'rules_pending' ? ' — regras em preparação' : ''}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
        </div>
        {selectedService && <span className="selector-category">{selectedService.category}</span>}
      </div>
    </div>
  );
};

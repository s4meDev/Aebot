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

  return (
    <div className="service-selector-card">
      <label htmlFor="service-dropdown" className="selector-label">
        Serviço em análise
      </label>
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
            {svc.name}
          </option>
        ))}
      </select>
    </div>
  );
};

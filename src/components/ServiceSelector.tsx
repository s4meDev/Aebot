import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeText } from '../services/TextNormalizer';
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const normalizedQuery = normalizeText(query).value;
  const filteredServices = useMemo(() => {
    if (!normalizedQuery) return services;
    return services.filter((service) => normalizeText(
      `${service.name} ${service.category}`
    ).value.includes(normalizedQuery));
  }, [normalizedQuery, services]);

  useEffect(() => {
    if (!isOpen) return;
    searchRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    setQuery('');
  };

  const selectService = (serviceId: string) => {
    onSelect(serviceId);
    closeMenu();
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="service-selector-card"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          closeMenu();
          triggerRef.current?.focus();
        }
      }}
    >
      <span className="selector-index" aria-hidden="true">01</span>
      <div className="selector-content">
        <span id="service-selector-label" className="selector-label">
          Serviço em análise
        </span>
        <button
          ref={triggerRef}
          type="button"
          className={`service-select-trigger ${isOpen ? 'open' : ''}`}
          aria-labelledby="service-selector-label"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={() => {
            setQuery('');
            setIsOpen((open) => !open);
          }}
        >
          <span className="service-select-copy">
            <strong>{selectedService?.name ?? 'Selecione um serviço'}</strong>
            <span>{selectedService?.category ?? `${services.length} serviços disponíveis`}</span>
          </span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
        </button>

        {isOpen && (
          <div className="service-menu" id={menuId}>
            <div className="service-search">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="4.75" />
                <path d="m12 12 3.5 3.5" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar serviço"
                aria-label="Buscar serviço"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="service-option-list" role="listbox" aria-label="Serviços disponíveis">
              {filteredServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  role="option"
                  aria-selected={service.id === selectedServiceId}
                  className={`service-option ${service.id === selectedServiceId ? 'selected' : ''}`}
                  onClick={() => selectService(service.id)}
                >
                  <span className="service-option-check" aria-hidden="true">
                    {service.id === selectedServiceId ? '✓' : ''}
                  </span>
                  <span className="service-option-copy">
                    <strong>{service.name}</strong>
                    <span>{service.category}</span>
                  </span>
                  {service.analysisStatus === 'rules_pending' && (
                    <span className="service-option-status">Em preparação</span>
                  )}
                </button>
              ))}
              {!filteredServices.length && (
                <div className="service-empty-result">
                  Nenhum serviço encontrado para “{query.trim()}”.
                </div>
              )}
            </div>
            <div className="service-menu-footer">
              {filteredServices.length} de {services.length} serviços
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

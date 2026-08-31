import { useEffect, useMemo, useState } from 'react';
import { KnowledgeService } from './services/KnowledgeService';
import { ChatPanel } from './components/ChatPanel';
import { ServiceSelector } from './components/ServiceSelector';
import { ServiceDetails } from './components/ServiceDetails';
import { ConfigModal } from './components/ConfigModal';
import { usePersistentState } from './state/usePersistentState';
import { STORAGE_KEYS } from './constants/storageKeys';
import { serviceCatalogService } from './services/ServiceCatalogService';
import type { ServiceRecord } from './types';

const knowledgeService = new KnowledgeService();

export default function App() {
  // Começa vazio para nunca escolher um serviço que não veio do catálogo atual.
  const [selectedServiceId, setSelectedServiceId] = usePersistentState<string>(
    STORAGE_KEYS.SELECTED_SERVICE_ID,
    ''
  );
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [catalogStatus, setCatalogStatus] = useState<{
    source: 'backend' | 'local';
    version?: string;
    warning?: string;
  }>({ source: 'local' });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void serviceCatalogService.load().then((result) => {
      if (!active) return;
      if (result.type === 'success' && result.services) {
        setServices(result.services);
        setCatalogStatus({
          source: result.source ?? 'local',
          version: result.ruleStoreVersion,
          warning: result.warning,
        });
      } else {
        setError(result.message ?? 'Falha ao carregar catálogo de serviços AEGEA.');
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [configurationRevision]);

  useEffect(() => {
    if (!selectedServiceId && services[0]) {
      setSelectedServiceId(services[0].id);
    }
  }, [selectedServiceId, services, setSelectedServiceId]);

  const selectedService = services.find((service) => service.id === selectedServiceId);

  // O contexto só é remontado quando o serviço muda.
  const chatContext = useMemo(
    () => (selectedService ? knowledgeService.getServiceContext(selectedService) : ''),
    [selectedService]
  );

  if (loading) {
    return (
      <div className="sidepanel-shell">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Carregando Base de Regras AEGEA…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sidepanel-shell">
        <div className="error-box">
          <h3>Erro ao iniciar assistente</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-shell">
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <span className="brand-stroke primary" />
            <span className="brand-stroke secondary" />
          </div>
          <div className="brand-copy">
            <h1 className="app-title">AEBOT</h1>
            <p className="app-subtitle">Análise operacional</p>
          </div>
        </div>

        <button
          type="button"
          className="config-trigger-btn"
          onClick={() => setIsConfigOpen(true)}
          title="Configurações do AEBOT"
          aria-label="Abrir configurações"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
            <path d="M19.4 13.5a7.8 7.8 0 0 0 .05-1.5 7.8 7.8 0 0 0-.05-1.5l1.7-1.32-1.8-3.11-2 .81a8 8 0 0 0-2.6-1.5L14.4 3.25h-3.6l-.3 2.13a8 8 0 0 0-2.6 1.5l-2-.81-1.8 3.11 1.7 1.32a7.8 7.8 0 0 0-.05 1.5c0 .5.02 1 .05 1.5l-1.7 1.32 1.8 3.11 2-.81a8 8 0 0 0 2.6 1.5l.3 2.13h3.6l.3-2.13a8 8 0 0 0 2.6-1.5l2 .81 1.8-3.11-1.7-1.32Z" />
          </svg>
        </button>
      </header>

      <main className="main-content">
        <section className="workspace-context" aria-label="Contexto da análise">
          <ServiceSelector
            services={services}
            selectedServiceId={selectedServiceId}
            onSelect={setSelectedServiceId}
          />

          <div
            className={`catalog-status ${catalogStatus.source} ${catalogStatus.warning ? 'warning' : ''}`}
            title={catalogStatus.warning}
          >
            <span className="catalog-status-dot" aria-hidden="true" />
            {catalogStatus.warning ?? (
              catalogStatus.source === 'backend'
                ? `Base sincronizada${catalogStatus.version ? ` · ${catalogStatus.version}` : ''}`
                : 'Base de contingência'
            )}
          </div>
        </section>

        {selectedService ? (
          <>
            <ServiceDetails service={selectedService} services={services} />
            <ChatPanel
              service={selectedService}
              context={chatContext}
              configurationRevision={configurationRevision}
            />
          </>
        ) : (
          <div className="empty-state">Nenhum serviço selecionado.</div>
        )}
      </main>

      <footer className="app-footer">
        <span>Decisões fundamentadas em regras</span>
        <span aria-hidden="true">●</span>
      </footer>

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSaved={() => setConfigurationRevision((revision) => revision + 1)}
      />
    </div>
  );
}

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
      {/* Cabeçalho da extensão */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo">
            <span>AEGEA</span>
          </div>
          <div>
            <h1 className="app-title">AEBOT</h1>
            <p className="app-subtitle">Assistente de Análise Operacional</p>
          </div>
        </div>

        <button
          type="button"
          className="config-trigger-btn"
          onClick={() => setIsConfigOpen(true)}
          title="Configurações do Gemini"
        >
          Config
        </button>
      </header>

      {/* Serviço e área principal de análise */}
      <main className="main-content">
        <ServiceSelector
          services={services}
          selectedServiceId={selectedServiceId}
          onSelect={setSelectedServiceId}
        />

        <div
          className={`catalog-status ${catalogStatus.warning ? 'warning' : ''}`}
          title={catalogStatus.warning}
        >
          {catalogStatus.warning ?? (
            catalogStatus.source === 'backend'
              ? `Catálogo central${catalogStatus.version ? ` • base ${catalogStatus.version}` : ''}`
              : 'Catálogo local embarcado'
          )}
        </div>

        {selectedService ? (
          <>
            <ServiceDetails service={selectedService} />
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

      {/* Rodapé */}
      <footer className="app-footer">
        <span>AEBOT • Análise baseada em regras</span>
      </footer>

      {/* Configurações */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSaved={() => setConfigurationRevision((revision) => revision + 1)}
      />
    </div>
  );
}

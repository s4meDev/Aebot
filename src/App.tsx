import { useEffect, useMemo, useState } from 'react';
import { KnowledgeService } from './services/KnowledgeService';
import { serviceRepository } from './repositories/serviceRepository';
import { ChatPanel } from './components/ChatPanel';
import { ServiceSelector } from './components/ServiceSelector';
import { ServiceDetails } from './components/ServiceDetails';
import { ConfigModal } from './components/ConfigModal';
import { usePersistentState } from './state/usePersistentState';
import { STORAGE_KEYS } from './constants/storageKeys';
import type { ServiceRecord } from './types';

// Instância única do KnowledgeService para toda a aplicação — evita recriar a
// mesma dependência em múltiplos componentes (antes também era instanciado
// dentro do ChatPanel, gerando duas instâncias equivalentes sem necessidade).
const knowledgeService = new KnowledgeService(serviceRepository);

export default function App() {
  // Sem valor-semente fixo: o serviço realmente selecionado é sempre resolvido
  // a partir da lista carregada (ver `selectedService` abaixo). Um id "chutado"
  // aqui ficava dessincronizado do id real cadastrado em rulesStore.json assim
  // que a base de serviços mudasse.
  const [selectedServiceId, setSelectedServiceId] = usePersistentState<string>(
    STORAGE_KEYS.SELECTED_SERVICE_ID,
    ''
  );
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    void knowledgeService.loadServices().then((result) => {
      if (result.type === 'success' && result.services) {
        setServices(result.services);
      } else {
        setError(result.message ?? 'Falha ao carregar catálogo de serviços AEGEA.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedServiceId && services[0]) {
      setSelectedServiceId(services[0].id);
    }
  }, [selectedServiceId, services, setSelectedServiceId]);

  const selectedService = services.find((service) => service.id === selectedServiceId);

  // Contexto (system instruction) calculado uma única vez por serviço selecionado
  // e passado como prop para o ChatPanel — evita que o componente de chat precise
  // ter sua própria instância de KnowledgeService só para recalcular o mesmo dado.
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
      {/* Top extension header */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo">
            <span>AEGEA</span>
          </div>
          <div>
            <h1 className="app-title">Flow Service IA</h1>
            <p className="app-subtitle">Assistente do Analista Operacional</p>
          </div>
        </div>

        <button
          type="button"
          className="config-trigger-btn"
          onClick={() => setIsConfigOpen(true)}
          title="Configurações do Gemini"
        >
          ⚙️ Config
        </button>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <ServiceSelector
          services={services}
          selectedServiceId={selectedService?.id ?? ''}
          onSelect={setSelectedServiceId}
        />

        {selectedService ? (
          <>
            <ServiceDetails service={selectedService} />
            <ChatPanel service={selectedService} context={chatContext} />
          </>
        ) : (
          <div className="empty-state">Nenhum serviço selecionado.</div>
        )}
      </main>

      {/* Footer info */}
      <footer className="app-footer">
        <span>AEGEA Saneamento • Gemini 3.6 Flash Engine</span>
      </footer>

      {/* Settings Modal */}
      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { GEMINI_MODEL } from '../localConfig';
import { normalizeGeminiModel } from '../ai/GeminiProvider';
import {
  checkBackendAccess,
  getPackagedBackendUrl,
  normalizeBackendUrl,
  type BackendConnection,
} from '../ai/BackendClient';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type ConnectionTestState = BackendConnection | { state: 'idle' | 'checking' };

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, onSaved }) => {
  const packagedBackendUrl = getPackagedBackendUrl();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(GEMINI_MODEL);
  const [backendUrl, setBackendUrl] = useState('');
  const [backendToken, setBackendToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [connectionTest, setConnectionTest] = useState<ConnectionTestState>({ state: 'idle' });

  useEffect(() => {
    if (isOpen) {
      setApiKey(storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, ''));
      setModel(normalizeGeminiModel(
        storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, GEMINI_MODEL)
      ));
      setBackendUrl(
        packagedBackendUrl || storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
      );
      setBackendToken(storageAdapter.get<string>(STORAGE_KEYS.BACKEND_TOKEN, ''));
      setSaved(false);
      setBackendError('');
      setConnectionTest({ state: 'idle' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
    if (backendUrl.trim() && !normalizedBackendUrl) {
      setBackendError('Use HTTPS ou, neste computador, localhost/127.0.0.1 com HTTP.');
      return;
    }
    const previousBackendUrl = normalizeBackendUrl(
      storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
    );
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, apiKey.trim());
    storageAdapter.set(STORAGE_KEYS.GEMINI_MODEL, model);
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, normalizedBackendUrl ?? '');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, backendToken.trim());
    if (previousBackendUrl !== normalizedBackendUrl) {
      storageAdapter.remove(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION);
    }
    setBackendUrl(normalizedBackendUrl ?? '');
    setBackendError('');
    setSaved(true);
    onSaved();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClear = () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    setApiKey('');
    setSaved(true);
    onSaved();
  };

  const handleTestConnection = async () => {
    const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
    if (!normalizedBackendUrl) {
      setBackendError('Informe um endereço HTTPS ou um endereço local válido.');
      setConnectionTest({ state: 'idle' });
      return;
    }
    setBackendError('');
    setConnectionTest({ state: 'checking' });
    const access = await checkBackendAccess(normalizedBackendUrl, backendToken);
    if (access.state !== 'online') {
      setConnectionTest(access);
      return;
    }
    storageAdapter.set(
      STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
      access.catalog.ruleStoreVersion
    );
    setConnectionTest({ state: 'online', health: access.health });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow-inline">Configurações de IA</span>
            <h3>Conexões do assistente</h3>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <label className="form-group">
            <span className="label-text">URL do backend AEBOT</span>
            <input
              type="url"
              className="input-field"
              placeholder="http://127.0.0.1:8787"
              value={backendUrl}
              readOnly={Boolean(packagedBackendUrl)}
              onChange={(e) => {
                setBackendUrl(e.target.value);
                setBackendError('');
                setConnectionTest({ state: 'idle' });
              }}
            />
            <span className="help-text">
              {packagedBackendUrl
                ? 'Endereço fixado com segurança no pacote empresarial.'
                : 'Quando informada, a extensão usa a base e a IA centralizadas no servidor. HTTPS é obrigatório fora do computador local.'}
            </span>
            {backendError && <span className="help-text danger-text">{backendError}</span>}
          </label>

          <div className="connection-test-row">
            <button
              type="button"
              className="secondary-btn"
              disabled={connectionTest.state === 'checking'}
              onClick={() => void handleTestConnection()}
            >
              {connectionTest.state === 'checking' ? 'Testando…' : 'Testar acesso completo'}
            </button>
            {connectionTest.state === 'online' && (
              <span className={connectionTest.health.aiConfigured
                ? 'connection-status success'
                : 'connection-status warning'}>
                {connectionTest.health.aiConfigured
                  ? connectionTest.health.aiProvider === 'ollama'
                    ? 'Backend, token e catálogo acessíveis; IA local configurada.'
                    : connectionTest.health.aiProvider === 'workers-ai'
                      ? 'API online, token e catálogo acessíveis; Workers AI configurado.'
                      : 'Backend, token e catálogo acessíveis; Gemini central configurado.'
                  : apiKey.trim()
                    ? 'Backend, token e catálogo ativos; Gemini será usado localmente.'
                    : 'Backend, token e catálogo ativos, mas sem IA central.'}
              </span>
            )}
            {connectionTest.state === 'offline' && (
              <span className="connection-status error">{connectionTest.message}</span>
            )}
          </div>

          <label className="form-group">
            <span className="label-text">Token do backend (opcional)</span>
            <input
              type="password"
              className="input-field"
              placeholder="Somente se configurado no servidor"
              value={backendToken}
              onChange={(e) => setBackendToken(e.target.value)}
            />
          </label>

          {!packagedBackendUrl && <label className="form-group">
            <span className="label-text">Chave de API do Gemini (Google AI Studio)</span>
            <input
              type="password"
              className="input-field"
              placeholder="Cole sua API Key do Gemini aqui"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <span className="help-text">
              Usada apenas no modo local. Quando houver backend, prefira configurar GEMINI_API_KEY somente no servidor.
            </span>
            <span className="help-text">
              Com o Gemini ativo, a pergunta, até 6 mensagens recentes e as regras relacionadas são enviadas ao Google para interpretação e humanização.
            </span>
          </label>}

          {packagedBackendUrl && (
            <span className="help-text">
              Pacote empresarial: a IA e a base são centralizadas no backend. Nenhuma chave de IA é armazenada neste Chrome.
            </span>
          )}

          {!packagedBackendUrl && <label className="form-group">
            <span className="label-text">Modelo Selecionado</span>
            <input
              type="text"
              className="input-field"
              value={model}
              maxLength={80}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]+"
              required
              onChange={(e) => setModel(e.target.value)}
            />
          </label>}

          {saved && <div className="toast-success">✓ Configurações salvas com sucesso!</div>}

          <div className="modal-footer">
            {apiKey && !packagedBackendUrl && (
              <button type="button" className="secondary-btn danger-text" onClick={handleClear}>
                Remover Chave
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-btn">
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

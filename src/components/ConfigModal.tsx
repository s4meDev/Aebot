import React, { useState, useEffect } from 'react';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { GEMINI_MODEL } from '../localConfig';
import { normalizeGeminiModel } from '../ai/GeminiProvider';
import {
  checkBackendHealth,
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
      setBackendUrl(storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, ''));
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
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, apiKey.trim());
    storageAdapter.set(STORAGE_KEYS.GEMINI_MODEL, model);
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, normalizedBackendUrl ?? '');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, backendToken.trim());
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
    setConnectionTest(await checkBackendHealth(normalizedBackendUrl));
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
              onChange={(e) => {
                setBackendUrl(e.target.value);
                setBackendError('');
                setConnectionTest({ state: 'idle' });
              }}
            />
            <span className="help-text">
              Quando informada, a extensão usa a base e a IA centralizadas no servidor. HTTPS é obrigatório fora do computador local.
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
              {connectionTest.state === 'checking' ? 'Testando…' : 'Testar conexão'}
            </button>
            {connectionTest.state === 'online' && (
              <span className={connectionTest.health.geminiConfigured
                ? 'connection-status success'
                : 'connection-status warning'}>
                {connectionTest.health.geminiConfigured
                  ? 'Backend e Gemini central ativos.'
                  : apiKey.trim()
                    ? 'Backend ativo; Gemini será usado localmente.'
                    : 'Backend ativo, mas sem Gemini central.'}
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

          <label className="form-group">
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
          </label>

          <label className="form-group">
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
          </label>

          {saved && <div className="toast-success">✓ Configurações salvas com sucesso!</div>}

          <div className="modal-footer">
            {apiKey && (
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

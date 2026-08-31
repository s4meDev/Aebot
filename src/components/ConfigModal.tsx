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
  const [tokenError, setTokenError] = useState('');
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
      setTokenError('');
      setConnectionTest({ state: 'idle' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let validatedRuleStoreVersion: string | undefined;
    const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
    if (backendUrl.trim() && !normalizedBackendUrl) {
      setBackendError('Use HTTPS ou, neste computador, localhost/127.0.0.1 com HTTP.');
      return;
    }
    const normalizedToken = backendToken.trim();
    if (packagedBackendUrl && !normalizedToken) {
      setTokenError('Informe o token individual entregue a este analista.');
      return;
    }
    if (packagedBackendUrl && normalizedBackendUrl) {
      setConnectionTest({ state: 'checking' });
      const access = await checkBackendAccess(normalizedBackendUrl, normalizedToken);
      if (access.state !== 'online') {
        setConnectionTest(access);
        setTokenError(access.state === 'offline'
          ? access.message
          : 'Não foi possível validar este acesso.');
        return;
      }
      validatedRuleStoreVersion = access.catalog.ruleStoreVersion;
      setConnectionTest({ state: 'online', health: access.health });
    }
    const previousBackendUrl = normalizeBackendUrl(
      storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
    );
    if (packagedBackendUrl) {
      storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    } else {
      storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, apiKey.trim());
    }
    storageAdapter.set(STORAGE_KEYS.GEMINI_MODEL, model);
    storageAdapter.set(STORAGE_KEYS.BACKEND_URL, normalizedBackendUrl ?? '');
    storageAdapter.set(STORAGE_KEYS.BACKEND_TOKEN, normalizedToken);
    if (previousBackendUrl !== normalizedBackendUrl) {
      storageAdapter.remove(STORAGE_KEYS.BACKEND_RULE_STORE_VERSION);
    }
    if (validatedRuleStoreVersion) {
      storageAdapter.set(
        STORAGE_KEYS.BACKEND_RULE_STORE_VERSION,
        validatedRuleStoreVersion
      );
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
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow-inline">Configuração do AEBOT</span>
            <h3 id="config-modal-title">
              {packagedBackendUrl ? 'Acesso do analista' : 'Conexões do assistente'}
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar configurações"
          >
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
                  ? connectionTest.health.aiProviders.length > 1
                    ? 'API online, token e catálogo acessíveis; contingência entre provedores ativa.'
                    : connectionTest.health.aiProvider === 'workers-ai'
                      ? 'API online, token e catálogo acessíveis; Workers AI configurado.'
                      : 'API online, token e catálogo acessíveis; Gemini configurado.'
                  : apiKey.trim()
                    ? 'Backend, token e catálogo ativos; Gemini online será usado diretamente.'
                    : 'Backend, token e catálogo ativos, mas sem IA central.'}
              </span>
            )}
            {connectionTest.state === 'offline' && (
              <span className="connection-status error">{connectionTest.message}</span>
            )}
          </div>

          <label className="form-group">
            <span className="label-text">
              {packagedBackendUrl ? 'Token individual do analista' : 'Token do backend (opcional)'}
            </span>
            <input
              type="password"
              className="input-field"
              placeholder={packagedBackendUrl
                ? 'Cole o token recebido para este analista'
                : 'Somente se configurado no servidor'}
              value={backendToken}
              required={Boolean(packagedBackendUrl)}
              autoComplete="off"
              onChange={(e) => {
                setBackendToken(e.target.value);
                setTokenError('');
                setConnectionTest({ state: 'idle' });
              }}
            />
            {tokenError && <span className="help-text danger-text">{tokenError}</span>}
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
              Usada apenas no desenvolvimento direto da extensão. No pacote empresarial, a chave fica somente no servidor.
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
            <button
              type="submit"
              className="primary-btn"
              disabled={connectionTest.state === 'checking'}
            >
              {connectionTest.state === 'checking' ? 'Validando…' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

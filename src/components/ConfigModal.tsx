import React, { useState, useEffect } from 'react';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, ''));
      setModel(storageAdapter.get<string>(STORAGE_KEYS.GEMINI_MODEL, DEFAULT_MODEL));
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    storageAdapter.set(STORAGE_KEYS.GEMINI_API_KEY, apiKey.trim());
    storageAdapter.set(STORAGE_KEYS.GEMINI_MODEL, model);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClear = () => {
    storageAdapter.remove(STORAGE_KEYS.GEMINI_API_KEY);
    setApiKey('');
    setSaved(true);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow-inline">Configurações de IA</span>
            <h3>Google Gemini 3.6 Flash</h3>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <label className="form-group">
            <span className="label-text">Chave de API do Gemini (Google AI Studio)</span>
            <input
              type="password"
              className="input-field"
              placeholder="Cole sua API Key do Gemini aqui (AIzaSy...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <span className="help-text">
              Caso não possua chave, o assistente funcionará com a <strong>Engine de Simulação AEGEA</strong> baseada nas regras de negócio.
            </span>
          </label>

          <label className="form-group">
            <span className="label-text">Modelo Selecionado</span>
            <select className="select-control" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado - Ultra Rápido)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
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

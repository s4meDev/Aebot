import { useEffect, useState, type FormEvent } from 'react';
import { submitFeedback, type FeedbackSubmitResult } from '../api/FeedbackClient';
import type { FeedbackCategory } from '../api/feedbackContracts';

interface FeedbackModalProps {
  isOpen: boolean;
  serviceId: string;
  serviceName: string;
  onClose(): void;
}

export function FeedbackModal({
  isOpen,
  serviceId,
  serviceName,
  onClose,
}: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>('resposta_incorreta');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<FeedbackSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategory('resposta_incorreta');
    setMessage('');
    setResult(null);
    setSubmitting(false);
  }, [isOpen, serviceId]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || message.trim().length < 10) return;
    setSubmitting(true);
    setResult(null);
    const response = await submitFeedback({ serviceId, category, message: message.trim() });
    setResult(response);
    setSubmitting(false);
    if (response.state === 'saved') setMessage('');
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="feedback-title">Enviar feedback</h3>
            <span className="help-text">Serviço: {serviceName}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar feedback"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="modal-body">
            <label className="form-group">
              <span className="label-text">Categoria</span>
              <select
                className="input-field"
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                disabled={submitting}
              >
                <option value="resposta_incorreta">Resposta incorreta</option>
                <option value="regra_ausente">Regra ou caso ausente</option>
                <option value="dificuldade_entendimento">Resposta difícil de entender</option>
                <option value="interface">Problema na interface</option>
                <option value="sugestao">Sugestão</option>
                <option value="outro">Outro</option>
              </select>
            </label>

            <label className="form-group">
              <span className="label-text">O que aconteceu?</span>
              <textarea
                className="input-field feedback-textarea"
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 2_000))}
                placeholder="Explique o que deveria ser melhorado..."
                minLength={10}
                maxLength={2_000}
                required
                disabled={submitting}
                autoFocus
              />
              <span className="help-text">
                {message.length}/2000. Não inclua número de OS, nome, endereço ou outro dado pessoal.
              </span>
            </label>

            {result?.state === 'saved' && (
              <div className="toast-success">Feedback salvo. Obrigado por ajudar a melhorar o AEBOT.</div>
            )}
            {result && result.state !== 'saved' && (
              <div className="feedback-error">{result.message}</div>
            )}
          </div>

          <div className="modal-footer feedback-footer">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              {result?.state === 'saved' ? 'Fechar' : 'Cancelar'}
            </button>
            {result?.state !== 'saved' && (
              <button
                type="submit"
                className="primary-btn"
                disabled={submitting || message.trim().length < 10}
              >
                {submitting ? 'Salvando…' : 'Enviar feedback'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

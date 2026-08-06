import React, { useState, useEffect, useRef } from 'react';
import { type AiMessage, type ServiceRecord, type DecisionType } from '../types';
import { assistantProvider } from '../ai/BackendProvider';
import {
  checkBackendAccess,
  getPackagedBackendUrl,
  resolveBackendUrl,
  type BackendConnection,
} from '../ai/BackendClient';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { parseNewCaseCommand } from '../services/ConversationContextResolver';
import { FeedbackModal } from './FeedbackModal';

interface ChatPanelProps {
  service: ServiceRecord;
  /** Instrução da IA já montada para o serviço selecionado. */
  context: string;
  configurationRevision: number;
}

type BackendUiState = BackendConnection | { state: 'checking' };

function createWelcomeMessage(serviceName: string, isNewCase = false): AiMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: isNewCase
      ? `Novo caso iniciado para ${serviceName}. O contexto anterior foi descartado. Descreva os fatos observados.`
      : `Olá! Como posso ajudar na auditoria do ${serviceName}?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  service,
  context,
  configurationRevision,
}) => {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [backendConnection, setBackendConnection] = useState<BackendUiState>({
    state: 'not_configured',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isGeminiKeyConfigured = !getPackagedBackendUrl() && Boolean(
    storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, '').trim()
  );
  const isBackendConfigured = Boolean(resolveBackendUrl(
    storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
  ));

  useEffect(() => {
    const backendUrl = resolveBackendUrl(
      storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
    );
    if (!backendUrl.trim()) {
      setBackendConnection({ state: 'not_configured' });
      return;
    }
    let active = true;
    setBackendConnection({ state: 'checking' });
    const backendToken = storageAdapter.get<string>(STORAGE_KEYS.BACKEND_TOKEN, '');
    void checkBackendAccess(backendUrl, backendToken).then((connection) => {
      if (!active) return;
      setBackendConnection(connection.state === 'online'
        ? { state: 'online', health: connection.health }
        : connection);
    });
    return () => {
      active = false;
    };
  }, [configurationRevision]);

  useEffect(() => {
    setMessages([createWelcomeMessage(service.name)]);
  }, [service.id, service.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const startNewCase = () => {
    if (isThinking) return;
    setDraft('');
    setMessages([createWelcomeMessage(service.name, true)]);
  };

  const handleSend = async (customText?: string) => {
    const submittedText = (customText || draft).trim();
    if (!submittedText || isThinking) return;

    const newCaseCommand = parseNewCaseCommand(submittedText);
    if (newCaseCommand.isNewCase && !newCaseCommand.remainingPrompt) {
      startNewCase();
      return;
    }

    const textToSend = newCaseCommand.remainingPrompt ?? submittedText;
    // A mensagem atual vai separada. Assim ela não aparece duas vezes no backend.
    const requestHistory = newCaseCommand.isNewCase ? [] : messages;
    const initialMessages = newCaseCommand.isNewCase
      ? [createWelcomeMessage(service.name, true)]
      : messages;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: timeStr,
    };

    const updatedMessages = [...initialMessages, userMessage];
    setMessages(updatedMessages);
    if (!customText) setDraft('');
    setIsThinking(true);

    try {
      const response = await assistantProvider.generateResponse(
        context,
        textToSend,
        { id: service.id, name: service.name },
        requestHistory
      );

      if (isBackendConfigured && response.fallbackReason === 'backend_error') {
        setBackendConnection({
          state: 'offline',
          message: 'O backend não respondeu; o modo local foi utilizado.',
        });
      } else if (isBackendConfigured) {
        const backendUrl = resolveBackendUrl(
          storageAdapter.get<string>(STORAGE_KEYS.BACKEND_URL, '')
        );
        const backendToken = storageAdapter.get<string>(STORAGE_KEYS.BACKEND_TOKEN, '');
        void checkBackendAccess(backendUrl, backendToken).then((connection) => {
          setBackendConnection(connection.state === 'online'
            ? { state: 'online', health: connection.health }
            : connection);
        });
      }

      setMessages((current) => {
        const messagesWithContext = response.evaluation.contextApplied
          ? current.map((message) =>
              message.id === userMessage.id
                ? { ...message, contextQuery: response.evaluation.normalizedQuery }
                : message
            )
          : current;
        return [
          ...messagesWithContext,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            decision: response.decision ?? undefined,
          },
        ];
      });
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Não foi possível consultar a IA no momento.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const renderDecisionBadge = (decision?: DecisionType) => {
    if (!decision) return null;
    switch (decision) {
      case 'Conforme':
        return <span className="chat-badge conforme">✓ Conforme</span>;
      case 'Não Conforme':
        return <span className="chat-badge nc">⚠️ Não Conforme</span>;
      case 'Reprovado':
        return <span className="chat-badge reprovado">✖ Reprovado</span>;
    }
  };

  const engineStatus = (() => {
    if (backendConnection.state === 'checking') {
      return {
        label: 'Verificando',
        className: 'sim-mode',
        title: 'Verificando a conexão com o backend configurado',
      };
    }
    if (backendConnection.state === 'online') {
      if (backendConnection.health.aiConfigured) {
        const isOllama = backendConnection.health.aiProvider === 'ollama';
        const isWorkersAi = backendConnection.health.aiProvider === 'workers-ai';
        return {
          label: isOllama
            ? 'Backend + IA local'
            : isWorkersAi
              ? 'Backend + Workers AI'
              : 'Backend + Gemini',
          className: 'api-mode',
          title: isOllama
            ? `Backend conectado, modelo Ollama local configurado e base ${backendConnection.health.ruleStoreVersion}`
            : isWorkersAi
              ? `API online conectada, Workers AI configurado e base ${backendConnection.health.ruleStoreVersion}`
              : `Backend conectado, Gemini central configurado e base ${backendConnection.health.ruleStoreVersion}`,
        };
      }
      return isGeminiKeyConfigured
        ? {
            label: 'Backend + Gemini do Chrome',
            className: 'api-mode',
            title: 'Backend conectado; como o servidor está sem Gemini, este Chrome usa a chave local',
          }
        : {
            label: 'Backend sem IA',
            className: 'sim-mode',
            title: 'Backend conectado, mas nenhum interpretador semântico está configurado',
          };
    }
    if (backendConnection.state === 'offline') {
      return {
        label: 'Local • backend off',
        className: isGeminiKeyConfigured ? 'api-mode' : 'sim-mode',
        title: `${backendConnection.message} As análises usarão o modo local.`,
      };
    }
    return isGeminiKeyConfigured
      ? {
          label: 'Gemini local',
          className: 'api-mode',
          title: 'Interpretação Gemini local ativa; decisões validadas pelo motor de regras',
        }
      : {
          label: 'Motor local',
          className: 'sim-mode',
          title: 'Somente matching determinístico, sem interpretação semântica',
        };
  })();

  return (
    <section className="card chat-shell">
      <div className="chat-hero">
        <div className="chat-hero-title">
          <span className="assistant-mark" aria-hidden="true">A</span>
          <h3>Assistente de Análise</h3>
        </div>
        <div className="chat-actions">
          <button
            type="button"
            className="new-case-btn"
            onClick={() => setIsFeedbackOpen(true)}
            title="Enviar uma sugestão ou informar um problema"
          >
            Feedback
          </button>
          <button
            type="button"
            className="new-case-btn"
            disabled={isThinking}
            onClick={startNewCase}
            title="Descartar o contexto atual e iniciar outra Ordem de Serviço"
          >
            ↻ Novo caso
          </button>
          <span className={`engine-pill ${engineStatus.className}`} title={engineStatus.title}>
            {engineStatus.label}
          </span>
        </div>
      </div>

      {/* Perguntas sugeridas */}
      {service.suggestedQuestions && service.suggestedQuestions.length > 0 && (
        <div className="prompt-suggestions">
          <div className="prompt-row">
            {service.suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                type="button"
                className="suggestion-chip"
                onClick={() => void handleSend(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversa */}
      <div className="message-list">
        {messages.map((message) => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <div className="bubble-header">
              <span className="author-name">
                {message.role === 'user' ? 'Você' : 'AEBOT'}
              </span>
              <span className="timestamp">{message.timestamp}</span>
            </div>
            <div className={`bubble ${message.role}`}>
              {message.decision && renderDecisionBadge(message.decision)}
              <div className="bubble-body">{message.content}</div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="message-wrapper assistant">
            <div className="bubble assistant thinking">
              <span className="typing-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
              <span>Consultando regras do serviço</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Campo de envio */}
      <div className="input-box-container">
        <textarea
          className="chat-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Descreva a dúvida ou os fatos da OS..."
          rows={2}
        />
        <button
          type="button"
          className="send-btn"
          disabled={!draft.trim() || isThinking}
          onClick={() => void handleSend()}
        >
          Enviar
        </button>
      </div>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        serviceId={service.id}
        serviceName={service.name}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </section>
  );
};

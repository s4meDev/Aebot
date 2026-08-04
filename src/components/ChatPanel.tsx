import React, { useState, useEffect, useRef } from 'react';
import { type AiMessage, type ServiceRecord, type DecisionType } from '../types';
import { GeminiProvider } from '../ai/GeminiProvider';
import { storageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../constants/storageKeys';

interface ChatPanelProps {
  service: ServiceRecord;
  /** System instruction já construído para este serviço (ver App.tsx / KnowledgeService). */
  context: string;
}

const geminiProvider = new GeminiProvider();

export const ChatPanel: React.FC<ChatPanelProps> = ({ service, context }) => {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isGeminiKeyConfigured = Boolean(storageAdapter.get<string>(STORAGE_KEYS.GEMINI_API_KEY, ''));

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Olá! Como posso ajudar na auditoria do ${service.name}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [service.id, service.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || draft).trim();
    if (!textToSend || isThinking) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: timeStr,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!customText) setDraft('');
    setIsThinking(true);

    try {
      const response = await geminiProvider.generateResponse(
        context,
        textToSend,
        { id: service.id, name: service.name },
        messages
      );

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          decision: response.decision ?? undefined,
        },
      ]);
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

  return (
    <section className="card chat-shell">
      <div className="chat-hero">
        <div className="chat-hero-title">
          <span className="sparkle-icon">✨</span>
          <h3>Assistente de Inteligência Artificial</h3>
        </div>
        <span className={`engine-pill ${isGeminiKeyConfigured ? 'api-mode' : 'sim-mode'}`}>
          {isGeminiKeyConfigured ? 'Gemini API' : 'Simulador'}
        </span>
      </div>

      {/* Suggested Prompt Chips */}
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

      {/* Message List */}
      <div className="message-list">
        {messages.map((message) => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <div className="bubble-header">
              <span className="author-name">
                {message.role === 'user' ? 'Você' : 'Assistente IA'}
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
              <span>Analisando regras do serviço</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
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
          placeholder="Digite sua dúvida sobre o serviço..."
          rows={2}
        />
        <button
          type="button"
          className="send-btn"
          disabled={!draft.trim() || isThinking}
          onClick={() => void handleSend()}
        >
          Enviar ➔
        </button>
      </div>
    </section>
  );
};

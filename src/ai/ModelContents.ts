import type { AiMessage } from '../types';
import type { StructuredModelContent } from './StructuredModelClient';

export function buildModelContents(
  history: AiMessage[],
  currentPrompt: string,
  augmentedPrompt: string
): StructuredModelContent[] {
  const relevantHistory = history.filter((message) => message.id !== 'welcome');
  const lastMessage = relevantHistory[relevantHistory.length - 1];
  const historyWithoutCurrent =
    lastMessage?.role === 'user' && lastMessage.content.trim() === currentPrompt.trim()
      ? relevantHistory.slice(0, -1)
      : relevantHistory;

  const formattedHistory: StructuredModelContent[] = historyWithoutCurrent.slice(-6).map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.content }],
  }));

  return [...formattedHistory, { role: 'user', parts: [{ text: augmentedPrompt }] }];
}

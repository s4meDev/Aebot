import type { AiMessage, AnalysisRequest } from '../types';

export class RequestValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('; '));
    this.name = 'RequestValidationError';
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseAnalyzeRequest(value: unknown): AnalysisRequest {
  const source = record(value);
  if (!source) throw new RequestValidationError(['corpo deve ser um objeto JSON']);
  const issues: string[] = [];
  const serviceId = typeof source.serviceId === 'string' ? source.serviceId.trim() : '';
  const prompt = typeof source.prompt === 'string' ? source.prompt.trim() : '';
  if (!serviceId || serviceId.length > 100 || !/^[a-z0-9][a-z0-9._-]*$/i.test(serviceId)) {
    issues.push('serviceId inválido');
  }
  if (!prompt || prompt.length > 4_000) {
    issues.push('prompt deve conter entre 1 e 4000 caracteres');
  }

  const rawHistory = source.history ?? [];
  const history: AiMessage[] = [];
  if (!Array.isArray(rawHistory) || rawHistory.length > 12) {
    issues.push('history deve ser uma lista com no máximo 12 mensagens');
  } else {
    rawHistory.forEach((rawMessage, index) => {
      const message = record(rawMessage);
      const role = message?.role;
      const content = typeof message?.content === 'string' ? message.content.trim() : '';
      const contextQuery = typeof message?.contextQuery === 'string'
        ? message.contextQuery.trim()
        : undefined;
      const pendingInformation = Array.isArray(message?.pendingInformation) &&
        message.pendingInformation.length <= 6 &&
        message.pendingInformation.every(
          (item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 300
        )
        ? message.pendingInformation.map((item) => item.trim())
        : undefined;
      if (!message || (role !== 'user' && role !== 'assistant') || !content || content.length > 4_000) {
        issues.push(`history[${index}] inválida`);
        return;
      }
      if (contextQuery && contextQuery.length > 8_000) {
        issues.push(`history[${index}].contextQuery excede 8000 caracteres`);
        return;
      }
      history.push({
        id: typeof message.id === 'string' && message.id ? message.id.slice(0, 100) : `history-${index}`,
        role,
        content,
        contextQuery,
        pendingInformation,
        timestamp: typeof message.timestamp === 'string' ? message.timestamp.slice(0, 20) : '',
      });
    });
  }

  if (issues.length) throw new RequestValidationError(issues);
  return { serviceId, prompt, history };
}

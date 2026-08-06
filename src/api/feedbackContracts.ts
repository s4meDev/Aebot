export const FEEDBACK_CATEGORIES = [
  'resposta_incorreta',
  'regra_ausente',
  'dificuldade_entendimento',
  'interface',
  'sugestao',
  'outro',
] as const;

export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];

export interface FeedbackSubmission {
  serviceId: string;
  category: FeedbackCategory;
  message: string;
  appVersion: string;
}

export interface StoredFeedback extends FeedbackSubmission {
  id: string;
  analystId: string;
  createdAt: string;
  status: 'new';
}

export class FeedbackValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('; '));
    this.name = 'FeedbackValidationError';
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseFeedbackSubmission(value: unknown): FeedbackSubmission {
  const source = record(value);
  if (!source) throw new FeedbackValidationError(['corpo deve ser um objeto JSON']);
  const issues: string[] = [];
  const serviceId = typeof source.serviceId === 'string' ? source.serviceId.trim() : '';
  const category = typeof source.category === 'string' ? source.category.trim() : '';
  const message = typeof source.message === 'string' ? source.message.trim() : '';
  const appVersion = typeof source.appVersion === 'string' ? source.appVersion.trim() : '';

  if (!serviceId || serviceId.length > 100 || !/^[a-z0-9][a-z0-9._-]*$/i.test(serviceId)) {
    issues.push('serviceId inválido');
  }
  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
    issues.push('categoria de feedback inválida');
  }
  if (message.length < 10 || message.length > 2_000) {
    issues.push('feedback deve conter entre 10 e 2000 caracteres');
  }
  if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:\.\d{1,4})?$/.test(appVersion)) {
    issues.push('versão da extensão inválida');
  }
  if (issues.length) throw new FeedbackValidationError(issues);
  return {
    serviceId,
    category: category as FeedbackCategory,
    message,
    appVersion,
  };
}

export function parseFeedbackCategory(value: string | null): FeedbackCategory | undefined {
  if (!value) return undefined;
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory)
    ? value as FeedbackCategory
    : undefined;
}

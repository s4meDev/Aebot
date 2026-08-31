import type { AiMessage } from '../types';
import { normalizeText } from './TextNormalizer';

export interface ContextualQueryResolution {
  query: string;
  contextApplied: boolean;
  mode?: 'continuation' | 'correction';
  sourceMessageId?: string;
  /** A mensagem atual responde a uma pergunta objetiva da avaliação anterior. */
  clarificationApplied?: boolean;
  /** Perguntas pendentes ficam fora do texto avaliado para não virarem fatos. */
  clarificationQuestions?: string[];
}

export interface NewCaseCommand {
  isNewCase: boolean;
  remainingPrompt?: string;
}

const CONTINUATION_PREFIXES = [
  'mas ',
  'nesse caso',
  'neste caso',
  'nesse cenario',
  'neste cenario',
  'sobre isso',
  'quanto a isso',
  'e quanto',
  'isso ',
  'essa situacao',
  'esse caso',
];

const CONTINUATION_EXPRESSIONS = [
  'tambem',
  'qual prevalece',
  'qual regra prevalece',
  'qual a decisao',
  'qual seria a decisao',
  'isso muda',
];

const SHORT_CONTINUATIONS = new Set(['por que', 'porque', 'e agora', 'e ai']);

const CARRIED_FACT_PREFIXES = [
  ['nao foi apresentada', 'não foi apresentada'],
  ['nao apresentou', 'não apresentou'],
  ['nao mostrou', 'não mostrou'],
  ['nao tem', 'não tem'],
  ['faltaram', 'faltaram'],
  ['faltou', 'faltou'],
  ['faltam', 'faltam'],
  ['falta', 'falta'],
  ['sem', 'sem'],
] as const;

const CORRECTION_PREFIXES = [
  'na verdade',
  'corrigindo',
  'correcao',
  'retificando',
  'retificacao',
  'desconsidere',
  'considere agora',
  'preciso corrigir',
  'e o mesmo caso',
  'ainda e o mesmo caso',
  'no mesmo caso',
  'mesmo caso',
  'mudei uma informacao',
  'mudando uma informacao',
  'alterando a informacao',
  'agora a',
  'agora o',
  'agora as',
  'agora os',
];

const NEW_CASE_PREFIXES = [
  'vamos analisar outro caso',
  'vamos falar de outro caso',
  'vamos para outro caso',
  'quero analisar outro caso',
  'quero falar de outro caso',
  'comecar outro caso',
  'comecar novo caso',
  'iniciar outro caso',
  'iniciar novo caso',
  'esse e outro caso',
  'isso e outro caso',
  'agora e outro caso',
  'agora outro caso',
  'proximo caso',
  'mudar de caso',
  'trocar de caso',
  'reiniciar analise',
  'limpar conversa',
  'limpar o chat',
  'limpar chat',
  'novo caso',
  'nova analise',
  'outro caso',
  'e outro caso',
];

function correctionPrefix(prompt: string): string | undefined {
  return CORRECTION_PREFIXES.find(
    (prefix) => prompt === prefix || prompt.startsWith(`${prefix} `)
  );
}

function isContextualFollowUp(prompt: string): boolean {
  const normalized = normalizeText(prompt).value;
  if (!normalized) return false;
  if (SHORT_CONTINUATIONS.has(normalized)) return true;
  const isAdditiveContinuation =
    normalized.startsWith('e ') &&
    (normalized.includes(' tambem') || normalized.startsWith('e se '));
  if (isAdditiveContinuation) return true;
  if (CONTINUATION_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return CONTINUATION_EXPRESSIONS.some(
    (expression) => normalized === expression || normalized.includes(` ${expression}`)
  );
}

function lastUserMessage(history: AiMessage[]): AiMessage | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'user') return history[index];
  }
  return undefined;
}

function lastMessageIndex(history: AiMessage[], role: AiMessage['role']): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === role) return index;
  }
  return -1;
}

function clarificationMessage(prompt: string, history: AiMessage[]): AiMessage | undefined {
  const normalizedPrompt = normalizeText(prompt);
  if (!normalizedPrompt.value || normalizedPrompt.tokens.length > 12) return undefined;

  const lastUserIndex = lastMessageIndex(history, 'user');
  const lastAssistantIndex = lastMessageIndex(history, 'assistant');
  if (lastUserIndex < 0 || lastAssistantIndex <= lastUserIndex) return undefined;

  const assistantMessage = history[lastAssistantIndex];
  if (assistantMessage.pendingInformation?.length) return assistantMessage;

  // Compatibilidade com conversas iniciadas antes do estado estruturado.
  const assistantText = normalizeText(assistantMessage.content).value;
  const legacyClarification = assistantText.includes('para concluir a classificacao') ||
    assistantText.includes('preciso saber') ||
    assistantText.includes('informe a superintendencia') ||
    assistantText.includes('o que falta confirmar');
  return legacyClarification ? assistantMessage : undefined;
}

function expandAdditiveContinuation(previousText: string, current: string): string {
  const normalizedPrevious = normalizeText(previousText).value;
  const normalizedCurrent = normalizeText(current).value;
  if (!normalizedCurrent.startsWith('e ') || !normalizedCurrent.includes(' tambem')) {
    return current;
  }
  const carriedPrefix = CARRIED_FACT_PREFIXES.find(
    ([marker]) => normalizedPrevious === marker || normalizedPrevious.startsWith(`${marker} `)
  );
  if (!carriedPrefix) return current;

  const withoutLeadingConnector = current.trim().replace(/^e\s+/iu, '');
  return `${carriedPrefix[1]} ${withoutLeadingConnector}`;
}

/**
 * Une somente continuações linguísticas explícitas à última pergunta do analista.
 * A função não interpreta fatos nem decisões; apenas resolve a referência textual.
 */
export function resolveContextualQuery(
  prompt: string,
  history: AiMessage[] = []
): ContextualQueryResolution {
  const current = prompt.trim();
  const previous = lastUserMessage(history);
  const normalizedCurrent = normalizeText(current).value;
  const isCorrection = Boolean(correctionPrefix(normalizedCurrent));
  const clarification = clarificationMessage(current, history);
  const answersClarification = Boolean(clarification);
  if (
    !current ||
    !previous ||
    (!isCorrection && !answersClarification && !isContextualFollowUp(current))
  ) {
    return { query: current, contextApplied: false };
  }

  const previousText = (previous.contextQuery ?? previous.content)
    .trim()
    .replace(/[.!?;\s]+$/g, '');
  if (!previousText || previousText === current) {
    return { query: current, contextApplied: false };
  }

  const expandedCurrent = expandAdditiveContinuation(previousText, current);
  return {
    // Mantém a fronteira entre a mensagem anterior e a continuação. Isso
    // evita que a interrogação da frase nova transforme o fato anterior em pergunta.
    query: answersClarification
      ? `${previousText}. Informação solicitada: ${expandedCurrent}`
      : `${previousText}. ${expandedCurrent}`,
    contextApplied: true,
    mode: isCorrection ? 'correction' : 'continuation',
    sourceMessageId: previous.id,
    clarificationApplied: answersClarification || undefined,
    clarificationQuestions: clarification?.pendingInformation,
  };
}

/** Interpreta comandos de interface sem enviá-los ao motor de regras. */
export function parseNewCaseCommand(prompt: string): NewCaseCommand {
  const normalized = normalizeText(prompt).value;
  const prefix = NEW_CASE_PREFIXES.find(
    (candidate) => normalized === candidate || normalized.startsWith(`${candidate} `)
  );
  if (!prefix) return { isNewCase: false };

  const remainingPrompt = normalized.slice(prefix.length).trim();
  return {
    isNewCase: true,
    remainingPrompt: remainingPrompt || undefined,
  };
}

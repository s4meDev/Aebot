import type { AiMessage } from '../types';
import { normalizeText } from './TextNormalizer';

export interface ContextualQueryResolution {
  query: string;
  contextApplied: boolean;
  mode?: 'continuation' | 'correction';
  sourceMessageId?: string;
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
  if (!current || !previous || (!isCorrection && !isContextualFollowUp(current))) {
    return { query: current, contextApplied: false };
  }

  const previousText = (previous.contextQuery ?? previous.content)
    .trim()
    .replace(/[.!?;\s]+$/g, '');
  if (!previousText || previousText === current) {
    return { query: current, contextApplied: false };
  }

  return {
    query: `${previousText} ${current}`,
    contextApplied: true,
    mode: isCorrection ? 'correction' : 'continuation',
    sourceMessageId: previous.id,
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

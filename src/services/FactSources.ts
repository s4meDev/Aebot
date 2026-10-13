import { splitTextClauses } from './TextNormalizer';
import { detectSemanticPolarity } from './SemanticPolarity';

/** Cada oração negativa mantém sua citação literal, inclusive o conectivo. */
export function splitFactSources(query: string): string[] {
  return splitTextClauses(query).flatMap(clause => {
    if (detectSemanticPolarity(clause) !== 'absence') return [clause];
    return clause.split(/(?=\b(?:e\s+(?:não|nao|sem|falt\w*|nenhum\w*)|nem\s+(?!(?:sempre|por\s+isso|sequer|mesmo)\b)))/giu)
      .map(part => part.trim()).filter(Boolean);
  });
}

import { splitTextClauses } from '../services/TextNormalizer';
import { detectSemanticPolarity } from '../services/SemanticPolarity';

/** Separo itens negados sem inventar palavras: o “nem” continua na citação original. */
export function splitLocalSources(query: string): string[] {
  return splitTextClauses(query).flatMap(clause => {
    if (detectSemanticPolarity(clause) !== 'absence') return [clause];
    // “Nem sempre” e “nem por isso” não iniciam outra falta independente.
    const parts = clause.split(/(?=\bnem\s+(?!(?:sempre|por\s+isso|sequer|mesmo)\b))/giu)
      .map(part => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [clause];
  });
}

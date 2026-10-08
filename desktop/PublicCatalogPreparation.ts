/** A preparação só aceita entrada pública e não pode produzir texto de resposta. */
export function validatePublicPrefill(result: Record<string, unknown>, inputTokens: number): void {
  const settings = result.generation_settings as { n_predict?: unknown } | undefined;
  // Neste runtime, n_predict=0 ainda conta uma amostragem. A gramática vazia
  // obriga essa amostragem a ser apenas encerramento, nunca texto. O estado
  // salvo é conferido separadamente para conter exatamente os tokens de entrada.
  if (result.content !== '' || result.truncated !== false || settings?.n_predict !== 0 ||
      result.tokens_evaluated !== inputTokens ||
      ![0, 1].includes(Number(result.tokens_predicted)) ||
      typeof result.tokens_predicted !== 'number' ||
      !Array.isArray(result.tokens) || result.tokens.length !== result.tokens_predicted ||
      (result.tokens_predicted === 1 && result.stop_type !== 'eos')) {
    throw new Error('Preparação pública produziu texto ou contadores incompatíveis.');
  }
}

export function validatePublicSnapshot(result: Record<string, unknown>, inputTokens: number): void {
  if (result.n_saved !== inputTokens || !Number.isSafeInteger(result.n_written) || Number(result.n_written) < 1) {
    throw new Error('O estado preparado não contém somente a entrada pública.');
  }
}

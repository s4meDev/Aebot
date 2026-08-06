import crypto from 'node:crypto';

// Estas funções não salvam nada: os scripts chamadores escolhem os arquivos de saída.
export function validateAnalystIds(ids) {
  if (!ids.length || ids.length > 100) throw new Error('Informe entre 1 e 100 analistas.');
  if (new Set(ids).size !== ids.length) throw new Error('A lista possui IDs duplicados.');
  for (const id of ids) {
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(id)) {
      throw new Error(`ID de analista inválido: ${id}`);
    }
  }
}

export function hashAccessToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createTokenBundle(analystIds, randomBytes = crypto.randomBytes) {
  validateAnalystIds(analystIds);
  const tokens = Object.fromEntries(
    analystIds.map((analystId) => [analystId, randomBytes(32).toString('base64url')])
  );
  if (new Set(Object.values(tokens)).size !== analystIds.length) {
    throw new Error('Falha ao gerar tokens únicos. Execute novamente.');
  }
  const tokenHashes = Object.fromEntries(
    Object.entries(tokens).map(([analystId, token]) => [analystId, hashAccessToken(token)])
  );
  return { tokens, tokenHashes };
}

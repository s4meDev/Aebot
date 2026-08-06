import { describe, expect, it } from 'vitest';
import {
  createTokenBundle,
  hashAccessToken,
  validateAnalystIds,
} from '../token-provisioning.mjs';

describe('provisionamento de tokens', () => {
  it('gera um token diferente e somente o hash para cada analista', () => {
    let seed = 0;
    const randomBytes = (size) => Buffer.alloc(size, seed += 1);
    const result = createTokenBundle(['analista01', 'analista02'], randomBytes);

    expect(result.tokens.analista01).not.toBe(result.tokens.analista02);
    expect(result.tokenHashes.analista01).toBe(hashAccessToken(result.tokens.analista01));
    expect(result.tokenHashes.analista01).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result.tokenHashes)).not.toContain(result.tokens.analista01);
  });

  it('rejeita IDs duplicados ou inseguros', () => {
    expect(() => validateAnalystIds(['analista01', 'analista01'])).toThrow('duplicados');
    expect(() => validateAnalystIds(['a b'])).toThrow('inválido');
  });
});

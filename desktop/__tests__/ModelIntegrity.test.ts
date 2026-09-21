import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyModelIntegrity } from '../ModelIntegrity';

describe('integridade do modelo externo', () => {
  it('aceita a cópia íntegra e recusa alteração de mesmo tamanho', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-model-test-'));
    const file = path.join(directory, 'model.gguf');
    const expected = { size: 4, sha256: createHash('sha256').update('GGUF').digest('hex') };
    await writeFile(file, 'GGUF');
    await expect(verifyModelIntegrity(file, expected)).resolves.toBeUndefined();
    await writeFile(file, 'FAKE');
    await expect(verifyModelIntegrity(file, expected)).rejects.toThrow('Integridade');
    await writeFile(file, '');
    await expect(verifyModelIntegrity(file, expected)).rejects.toThrow('Tamanho');
  });
});

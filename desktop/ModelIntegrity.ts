import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

/** A cópia externa do modelo só pode rodar se for idêntica à versão homologável. */
export async function verifyModelIntegrity(file: string, expected: { size: number; sha256: string }): Promise<void> {
  if ((await stat(file)).size !== expected.size) throw new Error('Tamanho do modelo inválido.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== expected.sha256) throw new Error('Integridade do modelo inválida.');
}

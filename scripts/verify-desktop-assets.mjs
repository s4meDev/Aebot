import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
async function hash(file) { const sum = createHash('sha256'); for await (const part of createReadStream(file)) sum.update(part); return sum.digest('hex'); }
const model = path.join(root, 'models', lock.model.name);
if ((await stat(model)).size !== lock.model.size || await hash(model) !== lock.model.sha256) throw new Error('Modelo ausente ou corrompido. Execute npm run desktop:assets.');
const files = JSON.parse(await readFile(path.join(root, 'runtime', 'checksums.json'), 'utf8'));
if (!files['llama-server.exe']) throw new Error('Runtime sem manifesto de integridade.');
for (const [file, expected] of Object.entries(files)) {
  if (path.basename(file) !== file || await hash(path.join(root, 'runtime', file)) !== expected) throw new Error('Runtime corrompido.');
}
await stat(path.join(root, 'licenses', 'Qwen-Apache-2.0.txt'));
await stat(path.join(root, 'licenses', 'llama-MIT.txt'));
console.log('Pacote offline conferido: Qwen Q4_K_M, runtime Windows x64 e licenças.');

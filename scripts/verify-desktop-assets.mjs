import { readFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runtimeDirectoryName, validateRuntimeInventory } from './runtime-security.mjs';
const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
const runtimeDirectory = runtimeDirectoryName(lock);
async function hash(file) { const sum = createHash('sha256'); for await (const part of createReadStream(file)) sum.update(part); return sum.digest('hex'); }
const model = path.join(root, 'models', lock.model.name);
if ((await stat(model)).size !== lock.model.size || await hash(model) !== lock.model.sha256) throw new Error('Modelo ausente ou corrompido. Execute npm run desktop:assets.');
const files = JSON.parse(await readFile(path.join(root, runtimeDirectory, 'checksums.json'), 'utf8'));
validateRuntimeInventory(files, await readdir(path.join(root, runtimeDirectory)));
if (!files['llama-server.exe']) throw new Error('Runtime sem manifesto de integridade.');
for (const [file, expected] of Object.entries(files)) {
  if (path.basename(file) !== file || await hash(path.join(root, runtimeDirectory, file)) !== expected) throw new Error('Runtime corrompido.');
}
const modelLicense = lock.model.licenseFile ?? 'Qwen-Apache-2.0.txt';
if (!/^[\w.-]+\.txt$/.test(modelLicense)) throw new Error('Nome de licença do modelo inválido.');
const licensePath = path.join(root, 'licenses', modelLicense);
await stat(licensePath);
if (lock.model.licenseSha256 && await hash(licensePath) !== lock.model.licenseSha256) throw new Error('Licença do modelo divergente.');
if (!/^[\w.-]+\.txt$/.test(lock.runtime.licenseFile)) throw new Error('Nome de licença inválido.');
await stat(path.join(root, 'licenses', lock.runtime.licenseFile));
console.log('Pacote offline conferido: Qwen Q4_K_M, runtime Windows x64 e licenças.');

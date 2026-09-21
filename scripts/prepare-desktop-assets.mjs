import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
async function hash(file) { const sum = createHash('sha256'); for await (const part of createReadStream(file)) sum.update(part); return sum.digest('hex'); }
async function download(url, file, expected) {
  if (existsSync(file)) {
    if (!expected || await hash(file) === expected) return;
    throw new Error(`Hash divergente: ${path.basename(file)}. Revise o arquivo antes de substituir.`);
  }
  console.log(`Baixando ${path.basename(file)}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`Download falhou: HTTP ${response.status}`);
  const temporary = path.join(root, `${randomUUID()}.partial`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
  if (expected && await hash(temporary) !== expected) throw new Error('Download rejeitado: hash SHA-256 divergente.');
  await rename(temporary, file);
}
for (const directory of ['models', 'runtime', 'licenses']) await mkdir(path.join(root, directory), { recursive: true });
const archive = path.join(root, `llama-${lock.runtime.version}.zip`);
await download(lock.runtime.url, archive, lock.runtime.sha256);
const existingRuntime = existsSync(path.join(root, 'runtime', 'llama-server.exe'));
if (existingRuntime) {
  // Não recalcula uma assinatura para aceitar silenciosamente um runtime alterado.
  const expected = JSON.parse(await readFile(path.join(root, 'runtime', 'checksums.json'), 'utf8'));
  if (!expected['llama-server.exe']) throw new Error('Runtime existente sem manifesto de integridade.');
  for (const [name, sum] of Object.entries(expected)) {
    if (path.basename(name) !== name || await hash(path.join(root, 'runtime', name)) !== sum) {
      throw new Error('Runtime existente alterado. Revise o pacote antes de preparar novamente.');
    }
  }
} else {
  // Só extrai o ZIP oficial depois de conferir o hash publicado na release.
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(path.join(root, 'runtime'))}`], { windowsHide: true, stdio: 'inherit' });
}
await download(lock.model.url, path.join(root, 'models', lock.model.name), lock.model.sha256);
await download(`https://huggingface.co/Qwen/Qwen3-4B-GGUF/raw/${lock.model.revision}/LICENSE`, path.join(root, 'licenses', 'Qwen-Apache-2.0.txt'));
await download(`https://raw.githubusercontent.com/ggml-org/llama.cpp/${lock.runtime.version}/LICENSE`, path.join(root, 'licenses', 'llama-MIT.txt'));
const runtimeFiles = {};
for (const name of await readdir(path.join(root, 'runtime'))) {
  if (/\.(exe|dll)$/i.test(name)) runtimeFiles[name] = await hash(path.join(root, 'runtime', name));
}
if (!runtimeFiles['llama-server.exe']) throw new Error('O ZIP não contém llama-server.exe na raiz.');
await writeFile(path.join(root, 'runtime', 'checksums.json'), JSON.stringify(runtimeFiles, null, 2));
console.log('Modelo e runtime preparados. O instalador pode ser distribuído sem download adicional pelos analistas.');

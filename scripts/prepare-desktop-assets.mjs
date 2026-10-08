import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runtimeDirectoryName, validateRuntimeArchiveEntries, validateRuntimeInventory } from './runtime-security.mjs';

const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
const runtimeDirectory = runtimeDirectoryName(lock);
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
for (const directory of ['models', runtimeDirectory, 'licenses']) await mkdir(path.join(root, directory), { recursive: true });
const archive = path.join(root, `llama-${lock.runtime.version}.zip`);
await download(lock.runtime.url, archive, lock.runtime.sha256);
const existingRuntime = existsSync(path.join(root, runtimeDirectory, 'llama-server.exe'));
if (existingRuntime) {
  // Não recalcula os hashes para aceitar silenciosamente um runtime alterado.
  const expected = JSON.parse(await readFile(path.join(root, runtimeDirectory, 'checksums.json'), 'utf8'));
  validateRuntimeInventory(expected, await readdir(path.join(root, runtimeDirectory)));
  if (!expected['llama-server.exe']) throw new Error('Runtime existente sem manifesto de integridade.');
  for (const [name, sum] of Object.entries(expected)) {
    if (path.basename(name) !== name || await hash(path.join(root, runtimeDirectory, name)) !== sum) {
      throw new Error('Runtime existente alterado. Revise o pacote antes de preparar novamente.');
    }
  }
} else {
  // ZIP com hash conferido, pasta vazia e entradas planas. O tar do Windows
  // extrai arquivos sem depender da execução de módulos PowerShell.
  const destination = path.join(root, runtimeDirectory);
  if ((await readdir(destination)).length) throw new Error('Extração anterior incompleta. Revise a pasta antes de continuar.');
  if (!process.env.SystemRoot || !path.isAbsolute(process.env.SystemRoot)) throw new Error('Windows não identificado.');
  const tar = path.join(process.env.SystemRoot, 'System32', 'tar.exe');
  validateRuntimeArchiveEntries(execFileSync(tar, ['-tf', archive], { encoding: 'utf8', windowsHide: true, timeout: 30_000 }));
  execFileSync(tar, ['-xkf', archive, '-C', destination], { windowsHide: true, stdio: 'inherit', timeout: 30_000 });
}
await download(lock.model.url, path.join(root, 'models', lock.model.name), lock.model.sha256);
const modelLicense = lock.model.licenseFile ?? 'Qwen-Apache-2.0.txt';
if (!/^[\w.-]+\.txt$/.test(modelLicense)) throw new Error('Nome de licença do modelo inválido.');
await download(lock.model.licenseUrl ?? `https://huggingface.co/Qwen/Qwen3-4B-GGUF/raw/${lock.model.revision}/LICENSE`,
  path.join(root, 'licenses', modelLicense), lock.model.licenseSha256);
// A licença vem do próprio ZIP já conferido, não de uma URL montada para outro publicador.
if (!/^[\w.-]+\.txt$/.test(lock.runtime.licenseFile)) throw new Error('Nome de licença inválido.');
await writeFile(path.join(root, 'licenses', lock.runtime.licenseFile), await readFile(path.join(root, runtimeDirectory, 'LICENSE')));
const runtimeFiles = {};
for (const name of await readdir(path.join(root, runtimeDirectory))) {
  if (/\.(exe|dll)$/i.test(name)) runtimeFiles[name] = await hash(path.join(root, runtimeDirectory, name));
}
if (!runtimeFiles['llama-server.exe']) throw new Error('O ZIP não contém llama-server.exe na raiz.');
await writeFile(path.join(root, runtimeDirectory, 'checksums.json'), JSON.stringify(runtimeFiles, null, 2));
console.log('Modelo e runtime offline preparados. A distribuição do instalador ainda exige assinatura do AEBOT e homologação.');

import { readFile, lstat, mkdir, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Copia somente os arquivos publicados no índice. Preparações antigas ficam
// preservadas na origem, fora da distribuição. Nenhum perfil de usuário é lido.
export async function copyPublicCatalog(source, destination, lock) {
  let contents;
  try {
    const file = path.join(source, 'index.json');
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 ** 2) throw new Error('Índice público inválido.');
    contents = await readFile(file, 'utf8');
  }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  if (contents.length > 1024 ** 2) throw new Error('Índice público grande demais.');
  const index = JSON.parse(contents);
  const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (!index || typeof index !== 'object' || Array.isArray(index) ||
      Object.keys(index).some(key => !['format', 'modelSha256', 'runtimeVersion', 'entries'].includes(key)) ||
      index.format !== 1 || index.modelSha256 !== lock.model.sha256 || index.runtimeVersion !== lock.runtime.version ||
      !Array.isArray(index.entries) || index.entries.length > 32) throw new Error('Catálogo preparado incompatível.');
  const identities = new Set();
  const copied = [];
  let bytes = 0;
  await mkdir(destination, { recursive: true });
  for (const entry of index.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !['instructionSha256', 'profileSha256', 'filename', 'sha256', 'size', 'tokens'].includes(key)) ||
        !sha(entry.instructionSha256) || !sha(entry.profileSha256) || !sha(entry.sha256) ||
        !/^[a-f0-9]{64}\.bin$/.test(entry.filename) || !Number.isSafeInteger(entry.size) ||
        entry.size <= 0 || entry.size > 512 * 1024 ** 2 || !Number.isSafeInteger(entry.tokens) || entry.tokens <= 0 ||
        entry.tokens > 16384) throw new Error('Entrada pública inválida.');
    const identity = entry.instructionSha256 + entry.profileSha256;
    if (identities.has(identity)) throw new Error('Entrada pública duplicada.');
    identities.add(identity); bytes += entry.size;
    if (bytes > 2 * 1024 ** 3) throw new Error('Catálogo preparado grande demais.');
    const file = path.join(source, entry.filename);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== entry.size) throw new Error('Arquivo público inválido.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (hash.digest('hex') !== entry.sha256) throw new Error('Arquivo público corrompido.');
    if (!copied.includes(entry.filename)) {
      await copyFile(file, path.join(destination, entry.filename));
      copied.push(entry.filename);
    }
  }
  await copyFile(path.join(source, 'index.json'), path.join(destination, 'index.json'));
  return copied;
}

// O hook roda antes de assinar o aplicativo empresarial. O cache é dado público,
// nunca substitui a assinatura do AEBOT ou altera EXEs/DLLs de fornecedor.
export default async function afterPack(context) {
  const root = path.resolve(import.meta.dirname, '..');
  const lock = JSON.parse(await readFile(path.join(root, 'desktop-resources/assets-lock.json'), 'utf8'));
  const build = JSON.parse(await readFile(path.join(root, 'desktop-dist/build-info.json'), 'utf8'));
  const source = path.join(root, 'desktop-resources/catalog-cache');
  if (build.publicCatalogIndexSha256) {
    const contents = await readFile(path.join(source, 'index.json'));
    if (createHash('sha256').update(contents).digest('hex') !== build.publicCatalogIndexSha256) {
      throw new Error('O catálogo preparado mudou depois do build. Recompile antes de empacotar.');
    }
  } else return; // Um build sem catálogo fixado não distribui um cache adicionado depois.
  await copyPublicCatalog(source,
    path.join(context.appOutDir, 'resources/local-ai/catalog-cache'), lock);
}

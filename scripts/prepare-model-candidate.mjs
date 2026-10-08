import { readFile, stat, rename, mkdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

// Só prepara candidatos fixados no catálogo técnico. Nunca substitui o modelo padrão.
const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const candidates = JSON.parse(await readFile(path.join(root, 'model-candidates.json'), 'utf8'));
const model = candidates[process.argv[2]];
if (!model || !/^[\w.-]+\.gguf$/.test(model.name) || !/^[a-f0-9]{64}$/.test(model.sha256)) {
  throw new Error('Candidato inexistente ou identidade inválida.');
}
const target = path.join(root, 'models', model.name);
const verify = async (file) => {
  if ((await stat(file)).size !== model.size) throw new Error('Tamanho do candidato divergente. Preserve o arquivo para diagnóstico.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== model.sha256) throw new Error('SHA-256 do candidato divergente. Não usar esse arquivo.');
};
const existing = await stat(target).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
if (existing) {
  await verify(target);
  console.log('Candidato já disponível e conferido.');
} else {
  await mkdir(path.dirname(target), { recursive: true });
  const response = await fetch(model.url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`Download recusado: HTTP ${response.status}.`);
  // wx preserva qualquer download anterior. Falha não apaga arquivos nem aceita uma cópia parcial.
  await pipeline(Readable.fromWeb(response.body), createWriteStream(`${target}.partial`, { flags: 'wx' }));
  await verify(`${target}.partial`);
  await rename(`${target}.partial`, target);
  console.log('Candidato preparado com tamanho e SHA-256 conferidos. Modelo anterior preservado.');
}

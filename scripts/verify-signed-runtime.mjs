import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath, writeFile, rename, lstat } from 'node:fs/promises';
import path from 'node:path';
import { inspectRuntimeSecurity, requireSignedRuntime, runtimeDirectoryName } from './runtime-security.mjs';

async function replaceJson(file, value) {
  // O builder pode copiar JSON por hard link. A troca atômica separa a cópia
  // do original; sobrescrever o conteúdo direto poderia mudar os hashes de origem.
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, file);
}

/** Confere as cópias já assinadas pelo builder, antes de montar o instalador. */
export default async function verifySignedRuntime(context) {
  if (context.electronPlatformName !== 'win32') throw new Error('Pacote suportado: Windows.');
  const output = await realpath(path.resolve(context.appOutDir));
  const assets = path.join(output, 'resources', 'local-ai');
  const lock = JSON.parse(await readFile(path.join(assets, 'assets-lock.json'), 'utf8'));
  const runtime = await realpath(path.join(assets, runtimeDirectoryName(lock)));
  if (path.relative(output, runtime).startsWith('..') || path.isAbsolute(path.relative(output, runtime))) {
    throw new Error('Runtime fora do pacote.');
  }
  const report = inspectRuntimeSecurity(runtime);
  requireSignedRuntime(report);
  const manifest = path.join(runtime, 'checksums.json');
  const provenance = path.join(runtime, 'signature-provenance.json');
  // Não sobrescreve destinos redirecionados por links. Os originais baixados ficam intactos.
  for (const file of [manifest, provenance]) {
    const info = await lstat(file).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error('Destino de integridade inválido.');
  }
  const upstream = JSON.parse(await readFile(manifest, 'utf8'));
  const names = report.signatures.map((item) => item.file);
  if (Object.keys(upstream).length !== names.length || names.some((name) =>
    typeof upstream[name] !== 'string' || !/^[a-f0-9]{64}$/i.test(upstream[name]))) {
    throw new Error('Os binários assinados não correspondem ao inventário de origem.');
  }
  const signed = {};
  for (const name of names) signed[name] = createHash('sha256').update(await readFile(path.join(runtime, name))).digest('hex');
  // A assinatura muda o hash. Registra ambos, sem aceitar novos hashes na origem.
  await replaceJson(provenance, { format: 'aebot-runtime-signatures-v1',
    upstreamChecksums: upstream, packagedChecksums: signed });
  await replaceJson(manifest, signed);
}

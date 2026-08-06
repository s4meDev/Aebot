import fs from 'node:fs';
import path from 'node:path';
import { createTokenBundle, validateAnalystIds } from './token-provisioning.mjs';

// O arquivo legível é entregue ao analista; somente os hashes vão para o Worker.
const projectRoot = path.resolve(import.meta.dirname, '..');
const argumentsList = process.argv.slice(2);

function option(name) {
  const index = argumentsList.indexOf(name);
  if (index < 0) return undefined;
  const value = argumentsList[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} exige um valor.`);
  return value;
}

function loadAnalystIds() {
  const inputPath = option('--input');
  if (inputPath) {
    const absolutePath = path.resolve(process.cwd(), inputPath);
    return fs.readFileSync(absolutePath, 'utf8')
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const count = Number(option('--count') ?? '40');
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('--count deve estar entre 1 e 100.');
  }
  return Array.from(
    { length: count },
    (_, index) => `analista${String(index + 1).padStart(2, '0')}`
  );
}

const analystIds = loadAnalystIds();
validateAnalystIds(analystIds);
const { tokens, tokenHashes } = createTokenBundle(analystIds);
const privateDirectory = path.resolve(
  process.cwd(),
  option('--output-dir') ?? path.relative(process.cwd(), path.join(projectRoot, '.aebot-private'))
);
fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const analystTokensPath = path.join(privateDirectory, `analyst-tokens-${timestamp}.json`);
const workerHashesPath = path.join(privateDirectory, `worker-token-hashes-${timestamp}.json`);

fs.writeFileSync(analystTokensPath, `${JSON.stringify(tokens, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
fs.writeFileSync(workerHashesPath, `${JSON.stringify(tokenHashes)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log(`${analystIds.length} tokens individuais gerados.`);
console.log(`Tokens dos analistas (privado): ${analystTokensPath}`);
console.log(`Hashes para o secret do Worker: ${workerHashesPath}`);
console.log('Os valores não foram exibidos. Guarde ambos em local seguro e distribua somente um token por analista.');

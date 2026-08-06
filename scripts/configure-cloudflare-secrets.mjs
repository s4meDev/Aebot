import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Lê os valores da pasta privada e os envia ao Wrangler sem mostrá-los no terminal.
const privateDirectory = path.resolve(process.cwd(), '.aebot-private');

function latestFile(prefix, suffix) {
  const matches = fs.readdirSync(privateDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({
      name,
      modifiedAt: fs.statSync(path.join(privateDirectory, name)).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  if (!matches.length) throw new Error(`Arquivo ${prefix}*${suffix} não encontrado.`);
  return path.join(privateDirectory, matches[0].name);
}

function readTrimmed(filePath) {
  return fs.readFileSync(filePath, 'utf8').trim();
}

function putSecret(name, value) {
  const wranglerPath = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const result = spawnSync(process.execPath, [wranglerPath, 'secret', 'put', name], {
    cwd: process.cwd(),
    input: `${value}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falha ao configurar ${name}.`);
}

const tokenHashes = readTrimmed(latestFile('worker-token-hashes-', '.json'));
const parsedTokenHashes = JSON.parse(tokenHashes);
if (
  !parsedTokenHashes ||
  typeof parsedTokenHashes !== 'object' ||
  Array.isArray(parsedTokenHashes) ||
  Object.keys(parsedTokenHashes).length !== 40 ||
  !Object.values(parsedTokenHashes).every((hash) =>
    typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)
  )
) {
  throw new Error('O arquivo de hashes dos analistas não contém exatamente 40 credenciais válidas.');
}

const adminHash = readTrimmed(latestFile('admin-token-hash-', '.txt'));
if (!/^[a-f0-9]{64}$/i.test(adminHash)) {
  throw new Error('Hash administrativo inválido.');
}

const extensionId = readTrimmed(path.join(privateDirectory, 'extension-id.txt'));
if (!/^[a-p]{32}$/.test(extensionId)) {
  throw new Error('ID estável da extensão inválido.');
}

putSecret('AEBOT_TOKEN_HASHES', tokenHashes);
putSecret('AEBOT_ADMIN_TOKEN_HASH', adminHash);
putSecret('AEBOT_ALLOWED_ORIGINS', `chrome-extension://${extensionId}`);
console.log('Credenciais dos analistas, do administrador e origem da extensão configuradas.');
console.log('Nenhum valor secreto foi exibido.');

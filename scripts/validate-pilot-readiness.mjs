import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const projectRoot = path.resolve(import.meta.dirname, '..');
const privateDirectory = path.join(projectRoot, '.aebot-private');
const distDirectory = path.join(projectRoot, 'dist');

function fail(message) {
  throw new Error(`Piloto não está pronto: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function latestFile(prefix, suffix) {
  if (!fs.existsSync(privateDirectory)) fail('pasta privada ausente');
  const match = fs.readdirSync(privateDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({ name, modifiedAt: fs.statSync(path.join(privateDirectory, name)).mtimeMs }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
  if (!match) fail(`arquivo privado ${prefix}*${suffix} ausente`);
  return path.join(privateDirectory, match.name);
}

function requiredText(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) fail(`${label} ausente`);
  const value = fs.readFileSync(filePath, 'utf8').trim();
  if (!value) fail(`${label} vazio`);
  return value;
}

const rawUrl = process.argv[2] ?? process.env.AEBOT_PRODUCTION_API_URL;
if (!rawUrl) fail('informe a origem da API como argumento ou AEBOT_PRODUCTION_API_URL');
const apiUrl = new URL(rawUrl);
if (
  apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search ||
  apiUrl.hash || (apiUrl.pathname !== '/' && apiUrl.pathname !== '')
) {
  fail('a API deve ser uma origem HTTPS sem caminho ou credenciais');
}
const apiOrigin = apiUrl.origin;

const packageData = readJson(path.join(projectRoot, 'package.json'));
const sourceManifest = readJson(path.join(projectRoot, 'manifest.json'));
const ruleStore = readJson(path.join(projectRoot, 'src', 'data', 'rulesStore.json'));
if (packageData.version !== sourceManifest.version) fail('package e manifest possuem versões diferentes');
// A aplicação e a base têm ciclos próprios. Exigir versões iguais faria uma
// atualização apenas das regras bloquear um pacote tecnicamente válido.
if (typeof ruleStore.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(ruleStore.version)) {
  fail('versão da base de regras inválida');
}

const tokens = readJson(latestFile('analyst-tokens-', '.json'));
const hashes = readJson(latestFile('worker-token-hashes-', '.json'));
const tokenIds = Object.keys(tokens).sort();
const hashIds = Object.keys(hashes).sort();
if (tokenIds.length !== 40 || hashIds.length !== 40) fail('são necessárias exatamente 40 credenciais');
if (JSON.stringify(tokenIds) !== JSON.stringify(hashIds)) fail('IDs dos tokens e hashes divergem');
for (const analystId of tokenIds) {
  const token = tokens[analystId];
  const hash = hashes[analystId];
  if (typeof token !== 'string' || token.length < 32) fail(`token inválido para ${analystId}`);
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
    fail(`hash inválido para ${analystId}`);
  }
  const calculated = createHash('sha256').update(token, 'utf8').digest('hex');
  if (calculated !== hash.toLowerCase()) fail(`token e hash divergem para ${analystId}`);
}

const publicKey = requiredText(
  path.join(privateDirectory, 'extension-public-key.txt'),
  'chave pública da extensão'
).replace(/\s+/g, '');
requiredText(path.join(privateDirectory, 'extension-private-key.pem'), 'chave privada da extensão');
const extensionId = requiredText(path.join(privateDirectory, 'extension-id.txt'), 'ID da extensão');
const publicKeyDer = Buffer.from(publicKey, 'base64');
if (publicKeyDer.length < 128) fail('chave pública inválida');
const calculatedExtensionId = createHash('sha256')
  .update(publicKeyDer)
  .digest()
  .subarray(0, 16)
  .toString('hex')
  .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)));
if (calculatedExtensionId !== extensionId) fail('ID não corresponde à chave pública');

const distManifest = readJson(path.join(distDirectory, 'manifest.json'));
if (distManifest.manifest_version !== 3) fail('pacote não é Manifest V3');
if (distManifest.version !== packageData.version) fail('versão do pacote gerado está desatualizada');
if (distManifest.key !== publicKey) fail('pacote não contém a identidade estável');
if (
  distManifest.host_permissions?.length !== 1 ||
  distManifest.host_permissions[0] !== `${apiOrigin}/*`
) {
  fail('pacote não está limitado à API oficial');
}
const expectedPolicy = `script-src 'self'; object-src 'self'; connect-src ${apiOrigin}`;
if (distManifest.content_security_policy?.extension_pages !== expectedPolicy) {
  fail('CSP do pacote não está limitada à API oficial');
}
for (const requiredFile of ['index.html', 'background.js']) {
  if (!fs.existsSync(path.join(distDirectory, requiredFile))) fail(`${requiredFile} ausente no pacote`);
}

console.log(
  `Piloto AEBOT ${packageData.version} com base ${ruleStore.version} pronto para 40 analistas.`
);
console.log(`Pacote: ${distDirectory}`);
console.log(`API: ${apiOrigin}`);
console.log('Credenciais, hashes e identidade estável conferidos sem exibir valores privados.');

import fs from 'node:fs';
import path from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';

// A mesma chave mantém o ID da extensão igual em todas as novas versões.
const privateDirectory = path.resolve(process.cwd(), '.aebot-private');
const privateKeyPath = path.join(privateDirectory, 'extension-private-key.pem');
const publicKeyPath = path.join(privateDirectory, 'extension-public-key.txt');
const extensionIdPath = path.join(privateDirectory, 'extension-id.txt');
const identityPaths = [privateKeyPath, publicKeyPath, extensionIdPath];
const existingCount = identityPaths.filter((filePath) => fs.existsSync(filePath)).length;

if (existingCount === identityPaths.length) {
  console.log('Identidade estável da extensão já existe. Nenhuma chave foi substituída.');
  console.log(`Arquivos privados: ${privateDirectory}`);
  process.exit(0);
}

if (existingCount > 0) {
  throw new Error(
    'Identidade parcial encontrada em .aebot-private. Preserve os arquivos existentes e restaure o conjunto antes de continuar.'
  );
}

fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const publicKeyBase64 = publicKey.toString('base64');
const extensionId = createHash('sha256')
  .update(publicKey)
  .digest()
  .subarray(0, 16)
  .toString('hex')
  .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)));

fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
fs.writeFileSync(publicKeyPath, `${publicKeyBase64}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
fs.writeFileSync(extensionIdPath, `${extensionId}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log('Identidade estável da extensão gerada sem exibir chaves ou ID.');
console.log(`Arquivos privados: ${privateDirectory}`);

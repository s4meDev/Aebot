import fs from 'node:fs';
import path from 'node:path';
import { createTokenBundle } from './token-provisioning.mjs';

// O painel administrativo usa uma credencial separada das credenciais dos analistas.
const projectRoot = path.resolve(import.meta.dirname, '..');
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf('--output-dir');
const outputDirectory = outputIndex >= 0 ? argumentsList[outputIndex + 1] : undefined;
if (outputIndex >= 0 && (!outputDirectory || outputDirectory.startsWith('--'))) {
  throw new Error('--output-dir exige um valor.');
}

const privateDirectory = path.resolve(
  process.cwd(),
  outputDirectory ?? path.relative(process.cwd(), path.join(projectRoot, '.aebot-private'))
);
fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const tokenPath = path.join(privateDirectory, `admin-token-${timestamp}.txt`);
const hashPath = path.join(privateDirectory, `admin-token-hash-${timestamp}.txt`);
const bundle = createTokenBundle(['responsavel']);
const token = bundle.tokens.responsavel;
const hash = bundle.tokenHashes.responsavel;

fs.writeFileSync(tokenPath, `${token}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
fs.writeFileSync(hashPath, `${hash}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

console.log('Token administrativo gerado sem exibir seu valor.');
console.log(`Token para acessar /admin: ${tokenPath}`);
console.log(`Hash para o secret AEBOT_ADMIN_TOKEN_HASH: ${hashPath}`);

import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Envia a chave pelo stdin do Wrangler para que ela nunca apareça no comando ou no log.
const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
if (!/^[A-Za-z0-9._-]{30,200}$/.test(apiKey)) {
  throw new Error('GEMINI_API_KEY ausente ou com formato inválido em .env.local.');
}

const wranglerPath = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const result = spawnSync(
  process.execPath,
  [wranglerPath, 'secret', 'put', 'GEMINI_API_KEY'],
  {
    cwd: process.cwd(),
    input: `${apiKey}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  }
);

if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Falha ao configurar GEMINI_API_KEY no Worker.');
console.log('Gemini online configurado no Worker sem exibir a chave.');

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(projectRoot, 'server-dist', 'index.js');

if (!fs.existsSync(bundlePath) || !fs.statSync(bundlePath).isFile()) {
  throw new Error('Validação do backend falhou: server-dist/index.js não foi gerado.');
}

const contents = fs.readFileSync(bundlePath, 'utf8');
const forbiddenPatterns = [
  { name: 'chave Gemini', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'chave exposta por Vite', pattern: /VITE_[A-Z0-9_]*KEY/ },
];

for (const forbidden of forbiddenPatterns) {
  if (forbidden.pattern.test(contents)) {
    throw new Error(`Validação do backend falhou: ${forbidden.name} encontrada no bundle.`);
  }
}

console.log('Backend Node validado sem segredos incorporados ao bundle.');

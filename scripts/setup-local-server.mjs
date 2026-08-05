import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(projectRoot, '.env.example');
const targetPath = path.join(projectRoot, '.env.local');

if (!fs.existsSync(sourcePath)) {
  throw new Error('Arquivo .env.example não encontrado.');
}

try {
  fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  console.log('.env.local criado com valores vazios e protegido pelo .gitignore.');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
    console.log('.env.local já existe e não foi alterado.');
  } else {
    throw error;
  }
}

console.log('Preencha GEMINI_API_KEY localmente e execute: npm run server:local');

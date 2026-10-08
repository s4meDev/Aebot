import { spawn } from 'node:child_process';
import { readFile, mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runtimeDirectoryName, validateRuntimeInventory } from './runtime-security.mjs';

const root = path.resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(path.join(root, 'desktop-resources/assets-lock.json'), 'utf8'));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
// Pasta nova por rodada. Nunca apaga ou reaproveita a distribuição assinada anterior.
const output = path.join(root, 'desktop-release', `prototipo-${version}-${timestamp}`);
await mkdir(output, { recursive: false });
await new Promise((resolve, reject) => {
  const builder = path.join(root, 'node_modules/electron-builder/cli.js');
  const child = spawn(process.execPath, [builder, '--config', 'electron-builder.prototype.json', '--win', '--x64', '--dir',
    `--config.directories.output=${output}`], { cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Falha ao preparar o protótipo. Não distribuir a pasta parcial.')));
});
const app = path.join(output, 'win-unpacked');
const resources = path.join(app, 'resources/local-ai');
await mkdir(path.join(resources, 'models'), { recursive: true });
await copyFile(path.join(root, 'desktop-resources/models', lock.model.name), path.join(resources, 'models', lock.model.name));
const hash = async (file) => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
};
const runtime = runtimeDirectoryName(lock);
const inventory = JSON.parse(await readFile(path.join(root, 'desktop-resources', runtime, 'checksums.json'), 'utf8'));
validateRuntimeInventory(inventory, await readdir(path.join(resources, runtime)));
for (const [name, expected] of Object.entries(inventory)) {
  if (path.basename(name) !== name || await hash(path.join(resources, runtime, name)) !== expected) {
    throw new Error('A cópia do runtime mudou. Não distribuir o protótipo.');
  }
}
const modelHash = await hash(path.join(resources, 'models', lock.model.name));
if (modelHash !== lock.model.sha256) throw new Error('Cópia do modelo divergente. Não distribuir.');
const hashes = { 'AEBOT-Prototipo.exe': await hash(path.join(app, 'AEBOT-Prototipo.exe')),
  'resources/app.asar': await hash(path.join(app, 'resources/app.asar')),
  [`resources/local-ai/models/${lock.model.name}`]: modelHash };
// O índice e as leituras públicas também entram nos hashes da distribuição.
let preparedCatalogEntries = 0;
try {
  const index = JSON.parse(await readFile(path.join(resources, 'catalog-cache/index.json'), 'utf8'));
  preparedCatalogEntries = index.entries.length;
  for (const name of ['index.json', ...new Set(index.entries.map(entry => entry.filename))]) {
    hashes[`resources/local-ai/catalog-cache/${name}`] = await hash(path.join(resources, 'catalog-cache', name));
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(path.join(app, 'SHA256SUMS.txt'), Object.entries(hashes).map(([name, sum]) => `${sum}  ${name}`).join('\r\n') + '\r\n');
await writeFile(path.join(app, 'LEIA-ME.txt'), `AEBOT ${version} — protótipo offline\r\n\r\nCopie esta pasta inteira para o notebook e abra AEBOT-Prototipo.exe.\r\nNão exige Node, chave, URL ou internet. Não mova somente o EXE.\r\nPode criar um atalho na Área de Trabalho apontando para esse EXE.\r\nConversas não são salvas. Métricas e feedbacks ficam no perfil local do usuário.\r\n\r\nEste perfil não possui assinatura própria do AEBOT nem homologação operacional.\r\nA identidade dos binários de fornecedor não assina nosso código em app.asar.\r\nNão desative proteção, desbloqueie arquivos ou ignore bloqueios para executá-lo.\r\nSe o Windows impedir a execução, preserve a mensagem e peça suporte.\r\nO funcionamento em outra máquina depende da política de segurança e dos recursos dela.\r\n`);
await writeFile(path.join(output, 'prototype-manifest.json'), JSON.stringify({ version, profile: 'prototype',
  packagedAt: new Date().toISOString(), aebotCodeSigned: false, operationalApproval: 'pending',
  model: lock.model.name, modelSha256: modelHash, preparedCatalogEntries, hashes }, null, 2));
console.log(`Protótipo completo: ${app}\nAbra AEBOT-Prototipo.exe. Sem certificado próprio; respeite bloqueios do Windows.`);

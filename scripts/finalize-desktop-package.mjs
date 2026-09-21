import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'desktop-release');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(root, 'desktop-resources', 'assets-lock.json'), 'utf8'));
const setup = `AEBOT-${version}-Setup.exe`;
await copyFile(path.join(root, 'desktop-resources', 'models', lock.model.name), path.join(output, lock.model.name));
const files = {};
for (const name of [setup, lock.model.name]) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(output, name))) hash.update(chunk);
  files[name] = hash.digest('hex');
}
if (files[lock.model.name] !== lock.model.sha256) throw new Error('Cópia do modelo inválida. Não distribua este pacote.');
await writeFile(path.join(output, 'SHA256SUMS.txt'), Object.entries(files).map(([file, hash]) => `${hash}  ${file}`).join('\n') + '\n');
await writeFile(path.join(output, 'LEIA-ME.txt'), `AEBOT ${version} — piloto offline\r\n\r\nMantenha ${setup} e ${lock.model.name} na mesma pasta.\r\nExecute o Setup e abra o atalho AEBOT. Não exige internet, chaves ou Node.\r\nReserve pelo menos 4 GB para instalação. Não distribua somente o EXE.\r\nA primeira inicialização confere o modelo antes de iniciar a IA.\r\nPacote de piloto: homologação operacional e aprovação da TI ainda necessárias.\r\n`);
console.log(`Pacote offline pronto em desktop-release: ${setup}, ${lock.model.name}, SHA256SUMS.txt e LEIA-ME.txt.`);

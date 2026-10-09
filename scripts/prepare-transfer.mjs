import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDownloadAssembler, DOWNLOAD_PART_BYTES } from './download-packet.mjs';

// Uso apenas o manifesto e as partes da entrega. Nunca copio o workspace ou perfis.
export function validateTransferManifest(value, version) {
  const allowed = ['version', 'zipName', 'zipHash', 'size', 'parts', 'aebotCodeSigned', 'operationalApproval'];
  const sha = hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
  if (!/^\d+\.\d+\.\d+$/.test(version) || !value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key)) || value.version !== version ||
      value.zipName !== `AEBOT-${version}.zip` || !sha(value.zipHash) ||
      !Number.isSafeInteger(value.size) || value.size <= 0 ||
      value.aebotCodeSigned !== false || value.operationalApproval !== 'pending' ||
      !Array.isArray(value.parts) || !value.parts.length || value.parts.length > 8) {
    throw new Error('Manifesto de transferência inválido ou de outra versão.');
  }
  let size = 0;
  for (const [index, part] of value.parts.entries()) {
    if (!part || typeof part !== 'object' || Array.isArray(part) ||
        Object.keys(part).some(key => !['name', 'sha256', 'size'].includes(key)) ||
        part.name !== `${value.zipName}.${String(index + 1).padStart(3, '0')}` || !sha(part.sha256) ||
        !Number.isSafeInteger(part.size) || part.size <= 0 || part.size > DOWNLOAD_PART_BYTES ||
        (index < value.parts.length - 1 && part.size !== DOWNLOAD_PART_BYTES)) {
      throw new Error('Parte de transferência inválida, fora de ordem ou grande demais.');
    }
    size += part.size;
  }
  if (size !== value.size) throw new Error('Tamanho total das partes divergente.');
  return value;
}

/** Confiro cada parte e o ZIP formado por elas sem gravar outro ZIP de vários GB. */
export async function verifyTransferParts(directory, manifest) {
  validateTransferManifest(manifest, manifest.version);
  const combined = createHash('sha256');
  for (const part of manifest.parts) {
    const file = path.join(directory, part.name);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== part.size) {
      throw new Error('Parte ausente, link ou tamanho divergente.');
    }
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) { hash.update(chunk); combined.update(chunk); }
    if (hash.digest('hex') !== part.sha256) throw new Error('Parte corrompida. Não envie a entrega.');
  }
  if (combined.digest('hex') !== manifest.zipHash) throw new Error('As partes não formam o ZIP esperado.');
}

export function createTransferGuide(manifest) {
  validateTransferManifest(manifest, manifest.version);
  const { version, zipName, parts } = manifest;
  return `AEBOT ${version} - COMO LEVAR PARA OUTRO PC\r\n\r\n` +
    `O QUE ENVIAR\r\n` +
    `Envie estes ${parts.length + 1} arquivos pelo WhatsApp como Documento, sem renomear:\r\n` +
    parts.map(part => `- ${part.name}\r\n`).join('') +
    `- COMECE-AQUI-${version}.zip\r\n` +
    `Pode enviar este LEIA-PRIMEIRO.txt junto. Ele também está dentro do ZIP pequeno.\r\n` +
    `Não mande o código-fonte nem somente o EXE. Para pendrive, pode copiar esta pasta inteira.\r\n\r\n` +
    `NO OUTRO COMPUTADOR\r\n` +
    `1. Use Windows 10/11 de 64 bits. No Latitude de 16 GB, reserve 16 GB livres no disco.\r\n` +
    `2. Crie uma pasta local, por exemplo Documentos\\AEBOT-${version}, e baixe todos os arquivos nela.\r\n` +
    `3. Clique com o botão direito em COMECE-AQUI-${version}.zip e escolha Extrair Tudo.\r\n` +
    `   Copie os arquivos extraídos (incluindo JUNTAR-PACOTE.cmd) para a pasta das partes .001, .002 etc.\r\n` +
    `4. Abra JUNTAR-PACOTE.cmd e aguarde. Ele confere os downloads e monta ${zipName}.\r\n` +
    `   Isso pode levar alguns minutos. Se informar falha, não prossiga: confira se baixou todas as partes.\r\n` +
    `5. Clique com o botão direito em ${zipName}, escolha Extrair Tudo e aguarde terminar.\r\n` +
    `6. Entre na pasta extraída e abra AEBOT-Prototipo.exe. Não abra por dentro do ZIP.\r\n` +
    `7. Aguarde a IA ficar pronta. Selecione o serviço, descreva o caso e envie a pergunta.\r\n` +
    `   O foco atual é Repavimentação Asfalto. Para outra OS, use Iniciar novo caso.\r\n` +
    `8. Para criar um atalho, clique com o botão direito no EXE, Mostrar mais opções,\r\n` +
    `   Enviar para, Área de Trabalho (criar atalho). Mantenha a pasta inteira no mesmo lugar.\r\n\r\n` +
    `NÃO PRECISA CONFIGURAR\r\n` +
    `Não exige VS Code, Node, instalação como administrador, chave de API ou servidor.\r\n` +
    `Após copiar e extrair, o aplicativo funciona sem internet. A primeira abertura e algumas\r\n` +
    `respostas podem demorar: a IA local usa a memória e o processador do notebook.\r\n` +
    `Não apague os downloads nem a versão anterior antes de conferir que a nova pasta está completa.\r\n\r\n` +
    `SE O WINDOWS BLOQUEAR\r\n` +
    `Pare e guarde a mensagem para o responsável verificar. Este protótipo não tem assinatura\r\n` +
    `própria do AEBOT e pode ser recusado pela segurança da máquina. Não desative proteções,\r\n` +
    `não desbloqueie arquivos nem altere a Execution Policy para contornar a recusa.\r\n\r\n` +
    `SOBRE O USO\r\n` +
    `É um protótipo, ainda sem homologação operacional. Confira a orientação antes de alterar a OS.\r\n` +
    `O AEBOT não lê as fotos automaticamente nem faz lançamentos no sistema.\r\n` +
    `As conversas somem ao fechar. Feedbacks e métricas ficam no próprio PC; para me enviar,\r\n` +
    `use a exportação nas configurações. Não inclua dados pessoais desnecessários.\r\n\r\n` +
    `Projeto idealizado e conduzido por Pedro Lucas Botelho.\r\n`;
}

async function createSupportZip(source, target) {
  if (process.platform !== 'win32') throw new Error('A criação do ZIP de apoio exige Windows.');
  // Só compacta o guia e o montador. Não executa o aplicativo nem altera políticas.
  const command = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem;
$sourcePath=(Resolve-Path -LiteralPath $env:AEBOT_TRANSFER_SUPPORT -ErrorAction Stop).Path;
$destination=(Resolve-Path -LiteralPath $env:AEBOT_TRANSFER_DESTINATION -ErrorAction Stop).Path;
$targetPath=[IO.Path]::GetFullPath((Join-Path $destination $env:AEBOT_TRANSFER_ZIP));
if ([IO.Path]::GetDirectoryName($targetPath) -ne $destination -or (Test-Path -LiteralPath $targetPath)) { throw 'Destino inválido ou existente.' };
[IO.Compression.ZipFile]::CreateFromDirectory($sourcePath,$targetPath,[IO.Compression.CompressionLevel]::Optimal,$false);`;
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      stdio: 'inherit', windowsHide: true, env: { ...process.env, AEBOT_TRANSFER_SUPPORT: source,
        AEBOT_TRANSFER_DESTINATION: path.dirname(target), AEBOT_TRANSFER_ZIP: path.basename(target) } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Não foi possível criar o ZIP de apoio.')));
  });
}

export async function prepareTransfer(root, requested) {
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const source = path.resolve(root, requested);
  const releaseRoot = path.join(root, 'desktop-release');
  if (path.dirname(source) !== releaseRoot || !path.basename(source).startsWith(`download-${version}-`)) {
    throw new Error('Selecione a pasta download da versão atual dentro de desktop-release.');
  }
  for (const directory of [releaseRoot, source]) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) {
      throw new Error('A pasta da entrega não pode ser um link ou redirecionamento.');
    }
  }
  const manifestFile = path.join(source, 'download-manifest.json');
  const info = await lstat(manifestFile);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024) throw new Error('Manifesto inválido.');
  const manifest = validateTransferManifest(JSON.parse(await readFile(manifestFile, 'utf8')), version);
  console.log('Conferindo os hashes das partes e do ZIP completo...');
  await verifyTransferParts(source, manifest);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.join(releaseRoot, `PARA-ENVIAR-AEBOT-${version}-${timestamp}`);
  const support = path.join(releaseRoot, `transfer-support-${version}-${timestamp}`);
  // Cada rodada cria pastas novas. Não substituo os downloads ou pacotes anteriores.
  await mkdir(output, { recursive: false });
  await mkdir(support, { recursive: false });
  for (const part of manifest.parts) {
    console.log('Copiando', part.name);
    await pipeline(createReadStream(path.join(source, part.name)), createWriteStream(path.join(output, part.name), { flags: 'wx' }));
  }
  // A cópia também precisa passar. O sucesso não depende só dos arquivos de origem.
  await verifyTransferParts(output, manifest);
  const guide = createTransferGuide(manifest);
  await writeFile(path.join(output, 'LEIA-PRIMEIRO.txt'), guide, { flag: 'wx' });
  await writeFile(path.join(support, 'LEIA-PRIMEIRO.txt'), guide, { flag: 'wx' });
  await writeFile(path.join(support, 'JUNTAR-PACOTE.cmd'), createDownloadAssembler(version, manifest.zipHash, manifest.parts), { flag: 'wx' });
  await writeFile(path.join(support, 'download-manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  await writeFile(path.join(support, 'SHA256SUMS-DOWNLOAD.txt'),
    [...manifest.parts.map(part => `${part.sha256}  ${part.name}`), `${manifest.zipHash}  ${manifest.zipName}`].join('\r\n') + '\r\n', { flag: 'wx' });
  await createSupportZip(support, path.join(output, `COMECE-AQUI-${version}.zip`));
  console.log(`Pronto para enviar: ${output}\nEnvie as ${manifest.parts.length} partes e o ZIP COMECE-AQUI como Documento.`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error('Informe somente a pasta download atual.');
  await prepareTransfer(path.resolve(import.meta.dirname, '..'), process.argv[2]);
}

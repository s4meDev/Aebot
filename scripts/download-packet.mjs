import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeDirectoryName, validateRuntimeInventory } from './runtime-security.mjs';

export const DOWNLOAD_PART_BYTES = 1024 ** 3;

// String.raw mantém as barras da regex no PowerShell; escapes JavaScript mudariam a validação.
export const zipEntryPathCheck = String.raw`(^[/\\]|(^|[/\\])\.\.([/\\]|$))`;

/** A montagem só junta arquivos conhecidos e confere hashes. Não executa o AEBOT ou muda proteções. */
export function createDownloadAssembler(version, zipHash, parts) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[a-f0-9]{64}$/.test(zipHash) ||
      !Array.isArray(parts) || !parts.length || parts.length > 8 ||
      parts.some((part, index) => part.name !== `AEBOT-${version}.zip.${String(index + 1).padStart(3, '0')}` ||
        !/^[a-f0-9]{64}$/.test(part.sha256))) throw new Error('Manifesto de download inválido.');
  const zip = `AEBOT-${version}.zip`;
  const checks = parts.map(part => `if ((Get-FileHash -LiteralPath '${part.name}' -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${part.sha256}') { throw 'Parte ausente ou corrompida.' }`).join('; ');
  const verify = `powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; try { if ((Get-FileHash -LiteralPath '${zip}' -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${zipHash}') { throw 'ZIP divergente.' } } catch { Write-Host 'O ZIP nao passou na conferencia.'; exit 1 }"`;
  return ['@echo off', 'setlocal', 'cd /d "%~dp0"', 'if errorlevel 1 exit /b 1',
    'echo AEBOT - montagem do pacote para teste supervisionado',
    `if exist "${zip}" goto existente`,
    `powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; try { ${checks} } catch { Write-Host 'Download incompleto ou corrompido. Baixe novamente as partes indicadas.'; exit 1 }"`,
    'if errorlevel 1 goto falha',
    `copy /b ${parts.map(part => `"${part.name}"`).join('+')} "${zip}" >nul`,
    'if errorlevel 1 goto falha', ':existente', verify, 'if errorlevel 1 goto falha',
    `echo ZIP conferido. Extraia ${zip} pelo Explorador de Arquivos.`,
    'echo Copie a pasta completa. Nao desative protecoes se o Windows bloquear o EXE.',
    'pause', 'exit /b 0', ':falha',
    'echo Montagem nao concluida. Nenhum arquivo foi apagado e nenhuma protecao foi alterada.',
    'echo Preserve a mensagem e solicite suporte se a politica impedir o comando.', 'pause', 'exit /b 1', ''].join('\r\n');
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function inventory(directory, relative = '') {
  const files = [];
  for (const item of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    const info = await lstat(path.join(directory, name));
    if (info.isSymbolicLink() || /(?:^|[\\/])(?:\.env.*|\.aebot-private|\.git|node_modules|\.wrangler|metrics\.json|feedback\.json|rules-release\.json|smoke-profile)$/.test(name)) {
      throw new Error('Arquivo privado ou link não pode entrar no download.');
    }
    if (info.isDirectory()) files.push(...await inventory(directory, name));
    else if (info.isFile()) files.push(name.replaceAll('\\', '/'));
    else throw new Error('Tipo de arquivo inesperado.');
  }
  return files;
}

export async function exportPrototype(root, requested) {
  if (process.platform !== 'win32') throw new Error('Preparação ZIP64 usa o Windows neste projeto.');
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versão inválida para o caminho de download.');
  const source = path.resolve(root, requested);
  const releaseRoot = path.join(root, 'desktop-release');
  if (path.dirname(path.dirname(source)) !== releaseRoot || path.basename(source) !== 'win-unpacked' ||
      !path.basename(path.dirname(source)).startsWith(`prototipo-${version}-`)) throw new Error('Selecione o protótipo atual dentro de desktop-release.');
  for (const directory of [releaseRoot, path.dirname(source), source]) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Pasta de origem inválida.');
  }
  const manifest = JSON.parse(await readFile(path.join(path.dirname(source), 'prototype-manifest.json'), 'utf8'));
  if (manifest.version !== version || manifest.profile !== 'prototype' || manifest.aebotCodeSigned !== false) throw new Error('Perfil de pacote inesperado.');
  const files = await inventory(source);
  const lock = JSON.parse(await readFile(path.join(root, 'desktop-resources/assets-lock.json'), 'utf8'));
  if (manifest.model !== lock.model.name || manifest.modelSha256 !== lock.model.sha256) throw new Error('Modelo do pacote não é o selecionado.');
  const runtimeDirectory = path.join(source, 'resources/local-ai', runtimeDirectoryName(lock));
  const runtimeHashes = JSON.parse(await readFile(path.join(runtimeDirectory, 'checksums.json'), 'utf8'));
  validateRuntimeInventory(runtimeHashes, await readdir(runtimeDirectory));
  for (const [name, hash] of Object.entries(runtimeHashes)) {
    if (await digest(path.join(runtimeDirectory, name)) !== hash) throw new Error('Runtime do pacote mudou. Não publicar.');
  }
  for (const [name, hash] of Object.entries(manifest.hashes)) {
    if (!files.includes(name) || !/^[a-f0-9]{64}$/.test(hash) || await digest(path.join(source, name)) !== hash) {
      throw new Error('Pacote alterado após preparação. Não publicar.');
    }
  }
  const output = path.join(releaseRoot, `download-${version}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(output, { recursive: false });
  const zipName = `AEBOT-${version}.zip`;
  const zip = path.join(output, zipName);
  // ZIP64 suporta o GGUF maior que 2 GB. Compress-Archive não é usado aqui.
  // Os caminhos são revalidados no próprio shell antes de criar o arquivo novo.
  const command = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem;
$sourcePath=(Resolve-Path -LiteralPath $env:AEBOT_DOWNLOAD_SOURCE -ErrorAction Stop).Path;
$targetDirectory=(Resolve-Path -LiteralPath $env:AEBOT_DOWNLOAD_OUTPUT -ErrorAction Stop).Path;
$targetPath=[IO.Path]::GetFullPath((Join-Path $targetDirectory $env:AEBOT_DOWNLOAD_NAME));
if ([IO.Path]::GetDirectoryName($targetPath) -ne $targetDirectory -or (Test-Path -LiteralPath $targetPath)) { throw 'Destino inesperado ou existente.' };
[IO.Compression.ZipFile]::CreateFromDirectory($sourcePath,$targetPath,[IO.Compression.CompressionLevel]::Fastest,$false);
$archive=[IO.Compression.ZipFile]::OpenRead($targetPath);
try { if (($archive.Entries | Where-Object { $_.Name }).Count -ne [int]$env:AEBOT_DOWNLOAD_FILE_COUNT) { throw 'Inventario ZIP divergente.' };
foreach ($entry in $archive.Entries) { if ($entry.FullName -match '${zipEntryPathCheck}') { throw 'Caminho ZIP inseguro.' } };
foreach ($line in (Get-Content -LiteralPath (Join-Path $sourcePath 'SHA256SUMS.txt'))) {
if ($line -notmatch '^([a-f0-9]{64})  (.+)$') { throw 'Hash de origem invalido.' };
$expected=$Matches[1]; $entryName=$Matches[2]; $entry=$archive.GetEntry($entryName);
# O .NET do Windows pode gravar barras invertidas; o manifesto usa barras normais.
if (-not $entry) { $entry=$archive.GetEntry($entryName.Replace([char]47,[char]92)) };
if (-not $entry) { throw 'Arquivo ausente no ZIP.' };
$stream=$entry.Open(); $algorithm=[Security.Cryptography.SHA256]::Create();
try { $actual=[BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant(); if ($actual -ne $expected) { throw 'Conteudo ZIP divergente.' } }
finally { $stream.Dispose(); $algorithm.Dispose() }
} } finally { $archive.Dispose() }; Write-Output 'ZIP64 criado e conteudo conferido.';`;
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      stdio: 'inherit', windowsHide: true, env: { ...process.env, AEBOT_DOWNLOAD_SOURCE: source,
        AEBOT_DOWNLOAD_OUTPUT: output, AEBOT_DOWNLOAD_NAME: zipName, AEBOT_DOWNLOAD_FILE_COUNT: String(files.length) } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('ZIP não foi validado. Preserve a pasta parcial; não publique.')));
  });
  const zipHash = await digest(zip);
  const { size } = await lstat(zip);
  const parts = [];
  for (let start = 0; start < size; start += DOWNLOAD_PART_BYTES) {
    const name = `${zipName}.${String(parts.length + 1).padStart(3, '0')}`;
    const file = path.join(output, name);
    await pipeline(createReadStream(zip, { start, end: Math.min(size - 1, start + DOWNLOAD_PART_BYTES - 1) }),
      createWriteStream(file, { flags: 'wx' }));
    parts.push({ name, sha256: await digest(file), size: (await lstat(file)).size });
  }
  await writeFile(path.join(output, 'JUNTAR-PACOTE.cmd'), createDownloadAssembler(version, zipHash, parts), { flag: 'wx' });
  await writeFile(path.join(output, 'download-manifest.json'), JSON.stringify({ version, zipName, zipHash, size,
    parts, aebotCodeSigned: false, operationalApproval: 'pending' }, null, 2), { flag: 'wx' });
  await writeFile(path.join(output, 'SHA256SUMS-DOWNLOAD.txt'),
    [...parts.map(part => `${part.sha256}  ${part.name}`), `${zipHash}  ${zipName}`].join('\r\n') + '\r\n', { flag: 'wx' });
  await writeFile(path.join(output, 'LEIA-PRIMEIRO.txt'),
    `AEBOT ${version} - prototipo offline para teste supervisionado\r\n\r\n` +
    `Baixe ${parts.map(part => part.name).join(', ')} e JUNTAR-PACOTE.cmd para a mesma pasta.\r\n` +
    `Abra JUNTAR-PACOTE.cmd. Ele confere as partes, monta ${zipName} e confere o ZIP.\r\n` +
    `Extraia o ZIP pelo Explorador. Reserve pelo menos 12 GB para partes, ZIP e extracao.\r\n` +
    `Depois copie a pasta inteira para o local permitido no notebook e abra AEBOT-Prototipo.exe.\r\n` +
    `Nao precisa de Node, VS Code, chave, URL ou servidor. Nao copie so o EXE.\r\n\r\n` +
    `O aplicativo ainda nao tem assinatura propria nem homologacao.\r\n` +
    `Se a politica bloquear o montador ou o EXE, pare e solicite suporte.\r\n` +
    `Nao altere protecoes, nao desbloqueie arquivos e nao mude a Execution Policy.\r\n` +
    `A montagem nao abre o aplicativo e nao apaga arquivos.\r\n` +
    `Hashes comprovam integridade, nao assinatura ou qualidade da IA.\r\n` +
    `Use um caso por conversa e confira a orientacao antes de agir no sistema.\r\n\r\n` +
    `Projeto idealizado e conduzido por Pedro Lucas Botelho.\r\n`, { flag: 'wx' });
  console.log(`Download preparado: ${output}\nZIP local completo e ${parts.length} partes para publicação. Sem homologação ou assinatura própria.`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requested = process.argv[2];
  if (!requested || process.argv.length !== 3) throw new Error('Informe somente a pasta win-unpacked do protótipo atual.');
  await exportPrototype(path.resolve(import.meta.dirname, '..'), requested);
}

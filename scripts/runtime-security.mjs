import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** O lock só pode selecionar uma pasta filha; nunca um caminho externo. */
export function runtimeDirectoryName(lock) {
  const directory = lock?.runtime?.directory ?? 'runtime';
  if (typeof directory !== 'string' || !/^runtime(?:-[a-z0-9-]+)?$/.test(directory)) {
    throw new Error('Diretório do runtime inválido.');
  }
  return directory;
}

/** Só aceita nomes planos e únicos; a extração não pode sair da pasta reservada. */
export function validateRuntimeArchiveEntries(list) {
  const entries = list.trim().split(/\r?\n/);
  if (!entries.includes('llama-server.exe') || entries.length > 200 ||
      new Set(entries.map((name) => name.toLowerCase())).size !== entries.length ||
      entries.some((name) => !/^[a-z0-9][\w.-]*$/i.test(name) || name.endsWith('.') ||
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))) throw new Error('Conteúdo inesperado no ZIP do runtime.');
  return entries;
}

/** Uma DLL extra ou ausente exige revisão, nunca atualização automática dos hashes. */
export function validateRuntimeInventory(manifest, names) {
  const binaries = names.filter((name) => /\.(exe|dll)$/i.test(name));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      !manifest['llama-server.exe'] || !manifest['ggml-base.dll'] ||
      Object.keys(manifest).length !== binaries.length ||
      Object.entries(manifest).some(([name, hash]) => !/^[\w.-]+\.(exe|dll)$/i.test(name) ||
        !binaries.includes(name) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash))) {
    throw new Error('Inventário de runtime divergente. Não recalcular hashes para aceitar arquivos extras.');
  }
}

/** Assinatura e integridade são verificações diferentes. Nenhuma homologa a IA. */
export function validateSecurityReport(value) {
  if (!value || typeof value !== 'object' ||
      !['on', 'off', 'evaluation', 'unknown'].includes(value.smartAppControl) ||
      typeof value.eventsReadable !== 'boolean' || !Array.isArray(value.recentBlocks) ||
      !Array.isArray(value.signatures) || !value.signatures.length) throw new Error('Diagnóstico de segurança inválido.');
  const names = new Set();
  const signatures = value.signatures.map((item) => {
    if (!item || typeof item.file !== 'string' || !/^[\w.-]+\.(exe|dll)$/i.test(item.file) ||
        typeof item.status !== 'string' || !['Valid', 'NotSigned', 'HashMismatch', 'NotTrusted',
          'UnknownError', 'NotSupportedFileFormat', 'Incompatible'].includes(item.status) ||
        names.has(item.file.toLowerCase())) throw new Error('Assinatura ausente ou inválida no diagnóstico.');
    names.add(item.file.toLowerCase());
    return { file: item.file, status: item.status };
  });
  if (!names.has('llama-server.exe') || !names.has('ggml-base.dll')) throw new Error('Runtime incompleto no diagnóstico.');
  const recentBlocks = value.recentBlocks.map((item) => {
    if (!item || !signatures.some((binary) => binary.file === item.file) || item.eventId !== 3077 ||
        typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at))) throw new Error('Evento de bloqueio inválido.');
    return { file: item.file, eventId: item.eventId, at: item.at };
  });
  return { smartAppControl: value.smartAppControl, eventsReadable: value.eventsReadable,
    signatures, recentBlocks,
    // Política conservadora do pacote AEBOT, não uma previsão exata do Smart App Control.
    // Arquivos sem assinatura às vezes passam por reputação em uma máquina e falham em outra.
    runtimeSignaturesValid: signatures.every((item) => item.status === 'Valid') };
}

export function inspectRuntimeSecurity(directory, execute = execFileSync) {
  if (process.platform !== 'win32') throw new Error('O diagnóstico de assinaturas exige Windows.');
  const script = path.join(import.meta.dirname, 'inspect-runtime-security.ps1');
  try {
    const output = execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script,
      '-RuntimeDirectory', path.resolve(directory)], {
      encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 1_000_000,
      stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    return validateSecurityReport(JSON.parse(output.replace(/^\uFEFF/, '').trim()));
  } catch {
    // Não repassa o stderr, que pode trazer caminhos pessoais ou conteúdo de outro processo.
    throw new Error('Não foi possível conferir as assinaturas. Solicite à TI a execução autorizada do diagnóstico PowerShell; não desative proteções.');
  }
}

export function requireSignedRuntime(report) {
  const checked = validateSecurityReport(report);
  if (!checked.runtimeSignaturesValid) throw new Error(
    'Pacote interrompido: existem binários do runtime sem assinatura válida. Consulte docs/ASSINATURA-E-LIBERACAO-WINDOWS.md.');
}

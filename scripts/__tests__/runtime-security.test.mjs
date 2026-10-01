import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { inspectRuntimeSecurity, requireSignedRuntime, runtimeDirectoryName, validateRuntimeArchiveEntries, validateRuntimeInventory, validateSecurityReport } from '../runtime-security.mjs';

const report = () => ({ smartAppControl: 'on', eventsReadable: true, recentBlocks: [], signatures: [
  { file: 'llama-server.exe', status: 'Valid' }, { file: 'ggml-base.dll', status: 'Valid' },
] });

describe('assinaturas e distribuição do runtime', () => {
  it.each(['../fora.dll', 'pasta/fora.dll', 'C:\\fora.dll', 'CON.dll', 'arquivo.', 'llama-server.exe'])('recusa ZIP com entrada perigosa ou duplicada: %s', (entry) => {
    expect(() => validateRuntimeArchiveEntries(`llama-server.exe\n${entry}`)).toThrow();
  });
  it('aceita ZIP plano e inventário completo, sem confundir licença com DLL', () => {
    expect(validateRuntimeArchiveEntries('llama-server.exe\r\nggml-base.dll\r\nLICENSE\r\n')).toHaveLength(3);
    expect(() => validateRuntimeInventory({ 'llama-server.exe': 'a'.repeat(64), 'ggml-base.dll': 'b'.repeat(64) },
      ['llama-server.exe', 'ggml-base.dll', 'LICENSE'])).not.toThrow();
  });
  it('não aceita DLL extra por recálculo silencioso do manifesto', () => {
    const manifest = { 'llama-server.exe': 'a'.repeat(64), 'ggml-base.dll': 'b'.repeat(64) };
    expect(() => validateRuntimeInventory(manifest, [...Object.keys(manifest), 'extra.dll'])).toThrow();
    expect(() => validateRuntimeInventory(manifest, ['llama-server.exe'])).toThrow();
  });
  it.each(['../runtime', 'C:\\runtime', 'runtime/fora', 'runtime-../fora', ''])('recusa diretório inseguro %s', (directory) => {
    expect(() => runtimeDirectoryName({ runtime: { directory } })).toThrow();
  });
  it('mantém a versão antiga separada e inclui só a versão selecionada no pacote', () => {
    const lock = JSON.parse(readFileSync(new URL('../../desktop-resources/assets-lock.json', import.meta.url), 'utf8'));
    const config = JSON.parse(readFileSync(new URL('../../electron-builder.json', import.meta.url), 'utf8'));
    expect(runtimeDirectoryName(lock)).toBe(lock.runtime.directory);
    expect(config.extraResources[0].filter).toContain(`${lock.runtime.directory}/**/*`);
    expect(config.extraResources[0].filter).not.toContain('runtime/**/*');
    expect(runtimeDirectoryName({ runtime: {} })).toBe('runtime');
  });
  it('aceita inventário assinado sem chamar isso de homologação ou liberação da política', () => {
    expect(validateSecurityReport(report()).runtimeSignaturesValid).toBe(true);
    expect(() => requireSignedRuntime(report())).not.toThrow();
  });
  it.each(['NotSigned', 'NotTrusted', 'HashMismatch', 'UnknownError'])('recusa DLL com assinatura %s', (status) => {
    const data = report(); data.signatures[1].status = status;
    expect(() => requireSignedRuntime(data)).toThrow('Pacote interrompido');
  });
  it('não permite um executável assinado esconder as DLLs sem assinatura', () => {
    const data = report(); data.signatures[1].status = 'NotSigned';
    expect(validateSecurityReport(data).runtimeSignaturesValid).toBe(false);
  });
  it('não confunde proteção desconhecida com desligada', () => {
    const data = report(); data.smartAppControl = 'unknown'; data.eventsReadable = false;
    expect(validateSecurityReport(data)).toMatchObject({ smartAppControl: 'unknown', eventsReadable: false });
  });
  it.each(['../fora.dll', 'C:\\fora.dll', 'ggml-base.dll/arquivo.exe'])('recusa caminho fora do inventário: %s', (file) => {
    const data = report(); data.signatures[1].file = file;
    expect(() => validateSecurityReport(data)).toThrow();
  });
  it('recusa inventário vazio, incompleto ou duplicado', () => {
    expect(() => validateSecurityReport({ ...report(), signatures: [] })).toThrow();
    expect(() => validateSecurityReport({ ...report(), signatures: report().signatures.slice(0, 1) })).toThrow();
    expect(() => validateSecurityReport({ ...report(), signatures: [...report().signatures, report().signatures[0]] })).toThrow();
  });
  it('mantém bloqueios como histórico, mesmo se o arquivo agora tem assinatura válida', () => {
    const data = report(); data.recentBlocks = [{ file: 'ggml-base.dll', eventId: 3077, at: '2026-09-29T18:30:00Z' }];
    expect(validateSecurityReport(data)).toMatchObject({ runtimeSignaturesValid: true, recentBlocks: data.recentBlocks });
  });
  it('recusa evento de arquivo alheio ao runtime', () => {
    const data = report(); data.recentBlocks = [{ file: 'outro.dll', eventId: 3077, at: '2026-09-29T18:30:00Z' }];
    expect(() => validateSecurityReport(data)).toThrow();
  });
  it.skipIf(process.platform !== 'win32')('usa argumentos separados e respeita a política do PowerShell', () => {
    const execute = vi.fn(() => JSON.stringify(report()));
    inspectRuntimeSecurity('pasta com espaços', execute);
    const [, args, options] = execute.mock.calls[0];
    expect(args).toContain('-File');
    expect(args.join(' ')).not.toMatch(/Bypass|Unrestricted|EncodedCommand/i);
    expect(options).toMatchObject({ shell: false, windowsHide: true, timeout: 30000 });
  });
  it.skipIf(process.platform !== 'win32')('não vaza exceção bruta quando a consulta é impedida', () => {
    expect(() => inspectRuntimeSecurity('runtime', () => { throw new Error('SEGREDO_TESTE'); })).toThrow('Solicite à TI');
    expect(() => inspectRuntimeSecurity('runtime', () => { throw new Error('SEGREDO_TESTE'); })).not.toThrow('SEGREDO_TESTE');
  });
  it('o builder exige assinatura e inclui DLLs, não apenas o Setup', () => {
    const config = JSON.parse(readFileSync(new URL('../../electron-builder.json', import.meta.url), 'utf8'));
    expect(config.forceCodeSigning).toBe(true);
    expect(config.win.signAndEditExecutable).toBe(true);
    expect(config.win.signExts).toContain('.dll');
    expect(config.afterSign).toBe('scripts/verify-signed-runtime.mjs');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import verifySignedRuntime from '../verify-signed-runtime.mjs';

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), rename: vi.fn(), real: vi.fn(), stat: vi.fn(), inspect: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.read, writeFile: mocks.write, rename: mocks.rename, realpath: mocks.real, lstat: mocks.stat }));
vi.mock('../runtime-security.mjs', async (original) => ({ ...(await original()), inspectRuntimeSecurity: mocks.inspect }));

const source = { 'llama-server.exe': 'a'.repeat(64), 'ggml-base.dll': 'b'.repeat(64) };
const context = { appOutDir: path.resolve('desktop-release', 'teste-sem-gravar'), electronPlatformName: 'win32' };
describe('conferência da cópia assinada antes do Setup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.real.mockImplementation(async (file) => file);
    mocks.stat.mockResolvedValue({ isFile: () => true, isSymbolicLink: () => false });
    mocks.read.mockImplementation(async (file) => path.basename(file) === 'assets-lock.json'
      ? JSON.stringify({ runtime: { directory: 'runtime-teste' } })
      : path.basename(file) === 'checksums.json' ? JSON.stringify(source) : Buffer.from('binário assinado simulado'));
    mocks.write.mockResolvedValue(undefined);
    mocks.rename.mockResolvedValue(undefined);
    mocks.inspect.mockReturnValue({ smartAppControl: 'on', eventsReadable: true, recentBlocks: [],
      signatures: Object.keys(source).map((file) => ({ file, status: 'Valid' })) });
  });
  it('registra hashes de origem e da cópia assinada, sem alterar os arquivos baixados', async () => {
    await verifySignedRuntime(context);
    expect(mocks.write).toHaveBeenCalledTimes(2);
    const provenance = JSON.parse(mocks.write.mock.calls[0][1]);
    expect(provenance.upstreamChecksums).toEqual(source);
    expect(provenance.packagedChecksums['ggml-base.dll']).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.packagedChecksums).not.toEqual(source);
    for (const [file] of mocks.write.mock.calls) expect(path.relative(context.appOutDir, file)).not.toMatch(/^\.\./);
    expect(JSON.parse(mocks.write.mock.calls[1][1])).toEqual(provenance.packagedChecksums);
    expect(mocks.rename).toHaveBeenCalledTimes(2);
    expect(path.basename(mocks.rename.mock.calls[1][1])).toBe('checksums.json');
    for (const [file, , options] of mocks.write.mock.calls) {
      expect(file).toMatch(/\.tmp$/);
      expect(options.flag).toBe('wx');
    }
  });
  it('não grava nada quando uma DLL não está assinada', async () => {
    // As respostas são simuladas; nenhum certificado real é usado.
    mocks.inspect.mockReturnValue({ smartAppControl: 'on', eventsReadable: true, recentBlocks: [], signatures: [
      { file: 'llama-server.exe', status: 'Valid' }, { file: 'ggml-base.dll', status: 'NotSigned' },
    ] });
    await expect(verifySignedRuntime(context)).rejects.toThrow('Pacote interrompido');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('não aceita inventário diferente após assinatura', async () => {
    mocks.read.mockResolvedValue(JSON.stringify({ 'llama-server.exe': source['llama-server.exe'] }));
    await expect(verifySignedRuntime(context)).rejects.toThrow('inventário');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('recusa destino fora do pacote', async () => {
    mocks.real.mockResolvedValueOnce(context.appOutDir).mockResolvedValueOnce(path.resolve('fora-do-pacote'));
    await expect(verifySignedRuntime(context)).rejects.toThrow('fora do pacote');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('não sobrescreve manifesto redirecionado por link', async () => {
    mocks.stat.mockResolvedValue({ isFile: () => true, isSymbolicLink: () => true });
    await expect(verifySignedRuntime(context)).rejects.toThrow('Destino de integridade inválido');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('não ignora diagnóstico indisponível', async () => {
    mocks.inspect.mockImplementation(() => { throw new Error('Consulta impedida'); });
    await expect(verifySignedRuntime(context)).rejects.toThrow('Consulta impedida');
    expect(mocks.write).not.toHaveBeenCalled();
  });
});

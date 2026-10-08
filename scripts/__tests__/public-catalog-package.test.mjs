import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { copyPublicCatalog } from '../package-public-catalog.mjs';

const mocks = vi.hoisted(() => ({ read: vi.fn(), stat: vi.fn(), mkdir: vi.fn(), copy: vi.fn(), stream: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.read, lstat: mocks.stat, mkdir: mocks.mkdir, copyFile: mocks.copy }));
vi.mock('node:fs', () => ({ createReadStream: mocks.stream }));
const lock = { model: { sha256: 'a'.repeat(64) }, runtime: { version: 'fixada' } };
const bytes = Buffer.from('catálogo público sintético');
const entry = { instructionSha256: 'b'.repeat(64), profileSha256: 'c'.repeat(64), filename: 'd'.repeat(64) + '.bin',
  sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, tokens: 100 };
const index = () => ({ format: 1, modelSha256: lock.model.sha256, runtimeVersion: lock.runtime.version, entries: [entry] });
describe('recurso público distribuído, sem arquivos de versões anteriores', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.read.mockResolvedValue(JSON.stringify(index()));
    mocks.stat.mockResolvedValue({ size: bytes.length, isFile: () => true, isSymbolicLink: () => false });
    mocks.stream.mockImplementation(() => Readable.from([bytes]));
    mocks.copy.mockResolvedValue(undefined); mocks.mkdir.mockResolvedValue(undefined);
  });
  it('copia apenas o índice e arquivos nele declarados e íntegros', async () => {
    expect(await copyPublicCatalog('origem', 'destino', lock)).toEqual([entry.filename]);
    expect(mocks.copy).toHaveBeenCalledTimes(2);
    expect(mocks.copy.mock.calls.flat().join(' ')).not.toContain('histórico');
  });
  it('pacote sem preparação continua possível, mas não anuncia cache', async () => {
    mocks.read.mockRejectedValue({ code: 'ENOENT' });
    expect(await copyPublicCatalog('origem', 'destino', lock)).toEqual([]);
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it('dois perfis validados podem referenciar um arquivo idêntico, copiado só uma vez', async () => {
    mocks.read.mockResolvedValue(JSON.stringify({ ...index(), entries: [entry, { ...entry, profileSha256: 'e'.repeat(64) }] }));
    expect(await copyPublicCatalog('origem', 'destino', lock)).toEqual([entry.filename]);
    expect(mocks.copy).toHaveBeenCalledTimes(2); // Um binário e o índice.
  });
  it.each(['modelSha256', 'runtimeVersion', 'format'])('recusa identidade incompatível: %s', async field => {
    const wrong = index(); wrong[field] = 'incompatível';
    mocks.read.mockResolvedValue(JSON.stringify(wrong));
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow();
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it.each([null, [], { ...index(), extra: true }, { ...index(), entries: [null] },
    { ...index(), entries: [{ ...entry, extra: true }] }])('recusa formato desconhecido sem copiar arquivos', async value => {
    mocks.read.mockResolvedValue(JSON.stringify(value));
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow();
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it('recusa índice que excede o limite antes de lê-lo', async () => {
    mocks.stat.mockResolvedValue({ size: 1024 ** 2 + 1, isFile: () => true, isSymbolicLink: () => false });
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow('Índice público inválido');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{ ...entry, filename: '../arquivo.bin' }, { ...entry, size: 0 }, { ...entry, sha256: 'x' },
    { ...entry, size: 513 * 1024 ** 2 }])('recusa entrada não confiável', async invalid => {
    mocks.read.mockResolvedValue(JSON.stringify({ ...index(), entries: [invalid] }));
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow();
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it('hash divergente ou link não entra no pacote', async () => {
    mocks.stream.mockImplementation(() => Readable.from([Buffer.from('alterado')]));
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow('corrompido');
    mocks.stat.mockResolvedValue({ size: bytes.length, isFile: () => true, isSymbolicLink: () => true });
    await expect(copyPublicCatalog('origem', 'destino', lock)).rejects.toThrow('inválido');
    expect(mocks.copy).not.toHaveBeenCalled();
  });
});

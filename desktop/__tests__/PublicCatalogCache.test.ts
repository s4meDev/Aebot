import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalogCache, catalogInstructionHash, catalogProfileHash, parsePublicCatalogIndex } from '../PublicCatalogCache';
import { runtimeResourceProfile } from '../ModelRuntime';
import assetsLock from '../../desktop-resources/assets-lock.json';

const mocks = vi.hoisted(() => ({ read: vi.fn(), stat: vi.fn(), integrity: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.read, lstat: mocks.stat }));
vi.mock('../ModelIntegrity', () => ({ verifyModelIntegrity: mocks.integrity }));
const profile = runtimeResourceProfile(8 * 1024 ** 3);
const entry = { instructionSha256: catalogInstructionHash('catálogo\n/no_think'),
  profileSha256: catalogProfileHash(profile), filename: 'a'.repeat(64) + '.bin', sha256: 'b'.repeat(64), size: 42, tokens: 123 };
const index = () => ({ format: 1, modelSha256: assetsLock.model.sha256, runtimeVersion: assetsLock.runtime.version, entries: [entry] });
function createCache(directory: string, connection: () => { url: string; token: string }, contents = JSON.stringify(index())) {
  return new PublicCatalogCache(directory, connection, profile, assetsLock.model.sha256,
    catalogInstructionHash(contents));
}

describe('catálogo público preparado, sem persistência de chat', () => {
  const fetcher = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue(JSON.stringify(index()));
    mocks.stat.mockResolvedValue({ size: 42, isFile: () => true, isDirectory: () => true, isSymbolicLink: () => false });
    mocks.integrity.mockResolvedValue(undefined);
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ n_restored: 123 }) });
    vi.stubGlobal('fetch', fetcher);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('confere identidade e integridade antes de restaurar, sem salvar o slot atual', async () => {
    const cache = createCache('recursos/catalog-cache', () => ({ url: 'http://127.0.0.1:1234', token: 'temporário' }));
    expect(await cache.restore('catálogo\n/no_think')).toBe(true);
    expect(mocks.integrity).toHaveBeenCalledWith(expect.stringContaining(entry.filename), entry);
    expect(fetcher.mock.calls[0][0].href).toBe('http://127.0.0.1:1234/slots/0?action=restore');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', body: JSON.stringify({ filename: entry.filename }),
      headers: { Authorization: 'Bearer temporário' } });
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('action=save');
  });
  it.each(['relato ou base alterada', 'catálogo\n/think'])('não reutiliza prefixo diferente: %s', async instruction => {
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
    expect(await cache.restore(instruction)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['model', 'runtime', 'profile'])('ignora estado incompatível (%s)', async difference => {
    const wrong = index();
    if (difference === 'model') wrong.modelSha256 = 'c'.repeat(64);
    if (difference === 'runtime') wrong.runtimeVersion = 'antigo';
    if (difference === 'profile') wrong.entries = [{ ...entry, profileSha256: 'd'.repeat(64) }];
    mocks.read.mockResolvedValue(JSON.stringify(wrong));
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }), JSON.stringify(wrong));
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('modelo corrompido ou arquivo não íntegro não chega ao runtime', async () => {
    mocks.integrity.mockRejectedValue(new Error('corrompido'));
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reinício restaura novamente, mas não repete uma falha na mesma conexão', async () => {
    let token = 'a';
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token }));
    fetcher.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ n_erased: 0 }) });
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    token = 'b'; fetcher.mockResolvedValue({ ok: true, json: async () => ({ n_restored: 123 }) });
    expect(await cache.restore('catálogo\n/no_think')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('ignora indisponibilidade, redirecionamento e contagem divergente sem aprovar nada', async () => {
    for (const reply of [undefined, { ok: true, json: async () => ({ n_restored: 9 }) }]) {
      fetcher.mockImplementation(async (url: URL) => {
        if (url.searchParams.get('action') === 'erase') return { ok: true, json: async () => ({ n_erased: 0 }) };
        if (!reply) throw new Error('redirect'); return reply;
      });
      const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
      expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    }
  });
  it('bloqueia novas inferências se a restauração falhar e não confirmar descarte da RAM', async () => {
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
    fetcher.mockResolvedValue({ ok: false });
    await expect(cache.restore('catálogo\n/no_think')).rejects.toThrow('segurança');
    await expect(cache.restore('catálogo diferente')).rejects.toThrow('Reinicie');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['https://127.0.0.1:1234', 'http://servidor.test', 'http://usuario@127.0.0.1:1234'])('não transmite catálogo ou credencial fora do loopback: %s', async url => {
    const cache = createCache('recursos', () => ({ url, token: 'a' }));
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('não aceita link, índice enorme nem arquivo ausente', async () => {
    for (const info of [{ size: 42, isDirectory: () => true, isFile: () => true, isSymbolicLink: () => true },
      { size: 2 * 1024 ** 2, isDirectory: () => true, isFile: () => true, isSymbolicLink: () => false }]) {
      mocks.stat.mockResolvedValue(info);
      const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
      expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    }
    mocks.stat.mockRejectedValue(new Error('ausente'));
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { ...entry, filename: '../privado.bin' }, { ...entry, sha256: '' }, { ...entry, size: 0 },
    { ...entry, size: 513 * 1024 ** 2 }, { ...entry, tokens: 0 }, { ...entry, prompt: 'não permitido' },
  ])('recusa caminho, tamanho, hash ou campos desconhecidos', invalid => {
    expect(() => parsePublicCatalogIndex({ ...index(), entries: [invalid] })).toThrow();
  });
  it('recusa duplicação e mudança silenciosa do formato', () => {
    expect(() => parsePublicCatalogIndex({ ...index(), entries: [entry, entry] })).toThrow();
    expect(() => parsePublicCatalogIndex({ ...index(), format: 2 })).toThrow();
  });
  it('não aceita índice externo se o build não fixou seu hash', async () => {
    const cache = new PublicCatalogCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }), profile);
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('adulterar índice e hash do arquivo juntos não passa pelo hash fixado no bundle', async () => {
    mocks.read.mockResolvedValue(JSON.stringify({ ...index(), entries: [{ ...entry, sha256: 'e'.repeat(64) }] }));
    const cache = createCache('recursos', () => ({ url: 'http://127.0.0.1:1234', token: 'a' }));
    expect(await cache.restore('catálogo\n/no_think')).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

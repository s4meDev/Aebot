import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTransferGuide, validateTransferManifest, verifyTransferParts, prepareTransfer } from '../prepare-transfer.mjs';
import { createDownloadAssembler, DOWNLOAD_PART_BYTES } from '../download-packet.mjs';

const version = '2.22.1';
const sha = text => createHash('sha256').update(text).digest('hex');
const manifest = { version, zipName: `AEBOT-${version}.zip`, zipHash: sha('abc'), size: 3,
  parts: [{ name: `AEBOT-${version}.zip.001`, sha256: sha('abc'), size: 3 }],
  aebotCodeSigned: false, operationalApproval: 'pending' };
const clone = () => structuredClone(manifest);

describe('pasta simples para transferência do protótipo', () => {
  it('aceita somente a versão atual e o perfil não homologado declarado', () => {
    expect(validateTransferManifest(manifest, version)).toBe(manifest);
    expect(() => validateTransferManifest(manifest, '2.22.2')).toThrow();
  });
  it.each([
    value => { value.zipName = '../fora.zip'; },
    value => { value.version = '2.22.1&comando'; },
    value => { value.zipHash = 'invalido'; },
    value => { value.size++; },
    value => { value.aebotCodeSigned = true; },
    value => { value.operationalApproval = 'approved'; },
    value => { value.secret = 'nao copiar'; },
    value => { value.parts = []; },
    value => { value.parts[0].name = '../arquivo'; },
    value => { value.parts[0].name = `AEBOT-${version}.zip.002`; },
    value => { value.parts[0].sha256 = 'invalido'; },
    value => { value.parts[0].size = DOWNLOAD_PART_BYTES + 1; },
    value => { value.parts[0].extra = 'nao copiar'; },
  ])('recusa manifesto inseguro ou inconsistente', mutate => {
    const value = clone(); mutate(value);
    expect(() => validateTransferManifest(value, version)).toThrow();
  });
  it('exige que todas as partes, menos a última, tenham o tamanho fixado', () => {
    const value = clone(); value.parts.push({ ...value.parts[0], name: `AEBOT-${version}.zip.002` }); value.size = 6;
    expect(() => validateTransferManifest(value, version)).toThrow();
    value.parts[0].size = DOWNLOAD_PART_BYTES; value.size = DOWNLOAD_PART_BYTES + 3;
    expect(validateTransferManifest(value, version)).toBe(value);
  });
  it('confere os bytes reais da parte e do ZIP montado', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-transfer-test-'));
    await writeFile(path.join(directory, manifest.parts[0].name), 'abc');
    await expect(verifyTransferParts(directory, manifest)).resolves.toBeUndefined();
    const value = clone(); value.zipHash = sha('outro');
    await expect(verifyTransferParts(directory, value)).rejects.toThrow('ZIP esperado');
    await writeFile(path.join(directory, manifest.parts[0].name), 'xyz');
    await expect(verifyTransferParts(directory, manifest)).rejects.toThrow('corrompida');
    await writeFile(path.join(directory, manifest.parts[0].name), 'mais bytes');
    await expect(verifyTransferParts(directory, manifest)).rejects.toThrow('tamanho');
  });
  it('não aceita origens externas nem pastas de outra versão', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'aebot-transfer-path-test-'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ version }));
    await expect(prepareTransfer(root, '../fora')).rejects.toThrow('Selecione');
    await expect(prepareTransfer(root, 'desktop-release/download-2.20.0-data')).rejects.toThrow('Selecione');
  });
  it('orienta extração e cópia completa sem prometer assinatura, homologação ou velocidade', () => {
    const guide = createTransferGuide(manifest);
    expect(guide).toContain(manifest.parts[0].name);
    expect(guide).toContain(`COMECE-AQUI-${version}.zip`);
    expect(guide).toContain('JUNTAR-PACOTE.cmd');
    expect(guide).toContain('sem renomear');
    expect(guide).toContain('reserve 16 GB');
    expect(guide).toContain('sem homologação operacional');
    expect(guide).toContain('não tem assinatura');
    expect(guide).toContain('Não desative proteções');
    expect(guide).toContain('podem demorar');
    expect(guide).not.toMatch(/Set-ExecutionPolicy|Unblock-File|Set-MpPreference|100%|sem erros/);
  });
  // Testo o montador real do Windows com bytes sintéticos, sem abrir o AEBOT.
  it.runIf(process.platform === 'win32')('o CMD junta partes reais e não sobrescreve um ZIP divergente', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aebot-transfer-cmd-test-'));
    const parts = [{ name: `AEBOT-${version}.zip.001`, sha256: sha('ab') },
      { name: `AEBOT-${version}.zip.002`, sha256: sha('c') }];
    await writeFile(path.join(directory, parts[0].name), 'ab');
    await writeFile(path.join(directory, parts[1].name), 'c');
    const script = path.join(directory, 'JUNTAR-PACOTE.cmd');
    await writeFile(script, createDownloadAssembler(version, sha('abc'), parts));
    const run = () => spawnSync('cmd.exe', ['/d', '/c', script], {
      cwd: directory, windowsHide: true, input: '\r\n', encoding: 'utf8', timeout: 15000 });
    const first = run();
    expect(first.error).toBeUndefined();
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const zip = path.join(directory, manifest.zipName);
    expect(await readFile(zip, 'utf8')).toBe('abc');
    await writeFile(zip, 'arquivo anterior diferente');
    const second = run();
    expect(second.status, second.stdout + second.stderr).toBe(1);
    expect(await readFile(zip, 'utf8')).toBe('arquivo anterior diferente');
  }, 25000);
});

import { describe, expect, it } from 'vitest';
import { createDownloadAssembler, DOWNLOAD_PART_BYTES, zipEntryPathCheck } from '../download-packet.mjs';

const version = '2.22.1';
const hash = 'a'.repeat(64);
const parts = [{ name: `AEBOT-${version}.zip.001`, sha256: 'b'.repeat(64) },
  { name: `AEBOT-${version}.zip.002`, sha256: 'c'.repeat(64) }];

describe('entrega em partes sem executar o aplicativo ou alterar segurança', () => {
  it('preserva as barras da validação de caminhos enviada ao PowerShell', () => {
    const pattern = new RegExp(zipEntryPathCheck);
    for (const name of ['/fora', '\\fora', '../fora', 'resources/../fora', 'resources\\..\\fora']) {
      expect(pattern.test(name)).toBe(true);
    }
    for (const name of ['resources/app.asar', 'resources/local-ai/model.gguf']) expect(pattern.test(name)).toBe(false);
    expect(zipEntryPathCheck).toContain('\\.\\.');
  });
  it('gera montagem explícita com hashes, sem sobrescrever ZIP existente', () => {
    const script = createDownloadAssembler(version, hash, parts);
    expect(DOWNLOAD_PART_BYTES).toBeLessThan(2 * 1024 ** 3);
    expect(script).toContain('if exist "AEBOT-2.22.1.zip" goto existente');
    expect(script).toContain('copy /b "AEBOT-2.22.1.zip.001"+"AEBOT-2.22.1.zip.002"');
    for (const value of [hash, ...parts.map(part => part.sha256)]) expect(script).toContain(value);
    expect(script).not.toMatch(/ExecutionPolicy|Unblock-File|Set-MpPreference|Remove-Item|start\s.*\.exe|\/Y\b/i);
  });
  it.each([
    ['2.22.1&del', hash, parts], [version, 'nao-hash', parts], [version, hash, []],
    [version, hash, [{ ...parts[0], name: '../fora' }]],
    [version, hash, [{ ...parts[0], sha256: "'; comando" }]],
    [version, hash, [parts[1], parts[0]]],
  ])('recusa metadados inseguros ou incompletos', (v, h, p) => {
    expect(() => createDownloadAssembler(v, h, p)).toThrow();
  });
});

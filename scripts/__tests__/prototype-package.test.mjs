import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('perfil portátil explícito, separado da distribuição empresarial', () => {
  const production = JSON.parse(readFileSync(new URL('../../electron-builder.json', import.meta.url), 'utf8'));
  const prototype = JSON.parse(readFileSync(new URL('../../electron-builder.prototype.json', import.meta.url), 'utf8'));
  const script = readFileSync(new URL('../package-prototype.mjs', import.meta.url), 'utf8');
  it('o Setup recebe o nome do modelo do mesmo lock usado no aplicativo', () => {
    const installer = readFileSync(new URL('../../desktop/installer.nsh', import.meta.url), 'utf8');
    const builder = readFileSync(new URL('../build-desktop.mjs', import.meta.url), 'utf8');
    expect(installer).toContain('${AEBOT_MODEL_FILE}');
    expect(installer).not.toContain('Qwen3-4B-Q4_K_M.gguf');
    expect(builder).toContain('assets.model.name');
    expect(builder).toContain('model-install.nsh');
  });
  it('mantém assinatura obrigatória no Setup empresarial', () => {
    expect(production.forceCodeSigning).toBe(true);
    expect(production.win.signAndEditExecutable).toBe(true);
    expect(production.afterSign).toBe('scripts/verify-signed-runtime.mjs');
  });
  it('identifica o protótipo e não reescreve binários do fornecedor', () => {
    expect(prototype.forceCodeSigning).toBe(false);
    expect(prototype.win.signAndEditExecutable).toBe(false);
    expect(prototype.extraMetadata.aebotDistributionProfile).toBe('prototype');
    expect(prototype.files).not.toContain('.env.local');
  });
  it('leva o modelo, verifica as cópias e não apaga pacotes anteriores', () => {
    expect(script).toContain('models');
    expect(script).toContain('modelHash !== lock.model.sha256');
    expect(script).toContain('validateRuntimeInventory');
    expect(script).toContain('aebotCodeSigned: false');
    expect(script).not.toMatch(/\b(?:rm|unlink|rmdir)\(/);
    expect(script).not.toMatch(/ExecutionPolicy|Unblock-File|Set-MpPreference|SmartScreenEnabled/);
  });
});

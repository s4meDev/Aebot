import { describe, expect, it } from 'vitest';
import { signingConfigurationSource } from '../../scripts/check-signing-configuration.mjs';

const config = { forceCodeSigning: true, win: { signAndEditExecutable: true, signtoolOptions: {} } };

describe('preparo da assinatura, sem ler ou revelar credenciais', () => {
  it('falha cedo quando não existe configuração, sem produzir outro pacote', () => {
    expect(() => signingConfigurationSource(config, {})).toThrow('Falta configurar');
  });
  it.each(['CSC_LINK', 'WIN_CSC_LINK'])('aceita referência segura pelo ambiente: %s', (name) => {
    expect(signingConfigurationSource(config, { [name]: 'SEGREDO_SINTETICO' })).toBe('ambiente seguro');
  });
  it('não trata senha isolada como certificado', () => {
    expect(() => signingConfigurationSource(config, { CSC_KEY_PASSWORD: 'SEGREDO_SINTETICO' })).toThrow('Falta configurar');
  });
  it.each(['certificateSha1', 'certificateSubjectName', 'certificateFile', 'sign'])('aceita configuração suportada pelo builder: %s', (field) => {
    const changed = { ...config, win: { ...config.win, signtoolOptions: { [field]: 'configuracao-sintetica' } } };
    expect(signingConfigurationSource(changed, {})).not.toContain('configuracao-sintetica');
  });
  it('não considera variável vazia ou whitespace uma credencial', () => {
    expect(() => signingConfigurationSource(config, { WIN_CSC_LINK: '  ' })).toThrow('Falta configurar');
  });
  it.each([
    { ...config, forceCodeSigning: false },
    { ...config, win: { ...config.win, signAndEditExecutable: false } },
  ])('não permite desligar a assinatura obrigatória', (changed) => {
    expect(() => signingConfigurationSource(changed, { CSC_LINK: 'SEGREDO_SINTETICO' })).toThrow('assinatura obrigatória');
  });
});

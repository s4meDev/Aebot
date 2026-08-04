import { describe, expect, it } from 'vitest';
import { isOriginAllowed, loadServerConfig } from '../config';

describe('configuração do backend', () => {
  it('usa defaults seguros no desenvolvimento local', () => {
    const config = loadServerConfig({});
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
    expect(isOriginAllowed('chrome-extension://abc', config)).toBe(true);
    expect(isOriginAllowed('https://site-invalido.example', config)).toBe(false);
  });

  it('exige origem e token explícitos em produção', () => {
    expect(() => loadServerConfig({ NODE_ENV: 'production' })).toThrow(/AEBOT_ALLOWED_ORIGINS/);
    expect(() => loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: 'chrome-extension://abc',
    })).toThrow(/AEBOT_API_TOKEN/);
  });

  it('aceita somente as origens cadastradas em produção', () => {
    const config = loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: 'chrome-extension://abc, https://painel.example/',
      AEBOT_API_TOKEN: 'segredo-de-teste',
    });
    expect(isOriginAllowed('chrome-extension://abc', config)).toBe(true);
    expect(isOriginAllowed('https://painel.example', config)).toBe(true);
    expect(isOriginAllowed('chrome-extension://outra', config)).toBe(false);
  });
});

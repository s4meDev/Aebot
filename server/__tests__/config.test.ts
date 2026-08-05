import { describe, expect, it } from 'vitest';
import { isOriginAllowed, loadServerConfig } from '../config';

describe('configuração do backend', () => {
  const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;

  it('usa defaults seguros no desenvolvimento local', () => {
    const config = loadServerConfig({});
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
    expect(config.rateLimitPerMinute).toBe(240);
    expect(config.trustProxy).toBe(false);
    expect(config.humanizeDeterministicResponses).toBe(false);
    expect(config.geminiModel).toBe('gemini-flash-latest');
    expect(config.geminiFallbackModel).toBe('gemini-flash-lite-latest');
    expect(isOriginAllowed('chrome-extension://abc', config)).toBe(true);
    expect(isOriginAllowed('https://site-invalido.example', config)).toBe(false);
  });

  it('exige origem e token explícitos em produção', () => {
    expect(() => loadServerConfig({ NODE_ENV: 'production' })).toThrow(/AEBOT_ALLOWED_ORIGINS/);
    expect(() => loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: extensionOrigin,
    })).toThrow(/AEBOT_API_TOKEN/);
  });

  it('aceita somente as origens cadastradas em produção', () => {
    const config = loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: `${extensionOrigin}, https://painel.example/`,
      AEBOT_API_TOKEN: 'token-de-teste-com-mais-de-32-caracteres',
    });
    expect(isOriginAllowed(extensionOrigin, config)).toBe(true);
    expect(isOriginAllowed('https://painel.example', config)).toBe(true);
    expect(isOriginAllowed('chrome-extension://outra', config)).toBe(false);
  });

  it('recusa wildcard, caminho e token fraco em produção', () => {
    expect(() => loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: 'https://*.example.com',
      AEBOT_API_TOKEN: 'token-de-teste-com-mais-de-32-caracteres',
    })).toThrow(/Origem CORS inválida/);
    expect(() => loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: 'https://painel.example/caminho',
      AEBOT_API_TOKEN: 'token-de-teste-com-mais-de-32-caracteres',
    })).toThrow(/Origem CORS inválida/);
    expect(() => loadServerConfig({
      NODE_ENV: 'production',
      AEBOT_ALLOWED_ORIGINS: extensionOrigin,
      AEBOT_API_TOKEN: 'fraco',
    })).toThrow(/32 caracteres/);
  });
});

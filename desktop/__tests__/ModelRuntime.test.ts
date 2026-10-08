import { describe, expect, it } from 'vitest';
import { ModelRuntime, runtimeResourceProfile } from '../ModelRuntime';

describe('orçamento experimental do runtime', () => {
  it('limita a memória auxiliar sem encurtar a janela nem criar processos paralelos', () => {
    const runtime = new ModelRuntime('recursos-de-teste', 512, 16 * 1024 ** 3);
    expect(runtime.resourceProfile).toEqual({ contextTokens: 16384, kvCache: 'q8_0',
      flashAttention: 'on', cacheRamMiB: 0, batchTokens: 512, microBatchTokens: 128, warmup: false });
    expect(Object.isFrozen(runtime.resourceProfile)).toBe(true);
    expect(runtime.connection()).toBeNull();
  });
  it.each([4, 8])('reserva contexto menor em %s GB, sem configurar nada pelo analista', (ram) => {
    expect(runtimeResourceProfile(ram * 1024 ** 3).contextTokens).toBe(8192);
  });
  it.each([12, 16, 32])('mantém contexto maior em %s GB', (ram) => {
    expect(runtimeResourceProfile(ram * 1024 ** 3).contextTokens).toBe(16384);
  });
  it.each([0, -1, NaN, Infinity])('recusa memória inválida: %s', (memory) => {
    expect(() => runtimeResourceProfile(memory)).toThrow('Memória física inválida');
  });
  it.each([NaN, Infinity, -1, 0, 31, 513, 128.5])('recusa orçamento inválido: %s', (budget) => {
    expect(() => new ModelRuntime('recursos-de-teste', budget)).toThrow('32 e 512');
  });
  it.each([32, 64, 128, 256, 512])('aceita orçamento limitado sem iniciar processo: %s', (budget) => {
    const runtime = new ModelRuntime('recursos-de-teste', budget);
    expect(runtime.connection()).toBeNull();
    expect(runtime.state).toBe('unavailable');
  });
});

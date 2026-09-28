import { describe, expect, it } from 'vitest';
import { ModelRuntime } from '../ModelRuntime';

describe('orçamento experimental do runtime', () => {
  it.each([NaN, Infinity, -1, 0, 31, 513, 128.5])('recusa orçamento inválido: %s', (budget) => {
    expect(() => new ModelRuntime('recursos-de-teste', budget)).toThrow('32 e 512');
  });
  it.each([32, 64, 128, 256, 512])('aceita orçamento limitado sem iniciar processo: %s', (budget) => {
    const runtime = new ModelRuntime('recursos-de-teste', budget);
    expect(runtime.connection()).toBeNull();
    expect(runtime.state).toBe('unavailable');
  });
});

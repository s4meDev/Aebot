import { describe, expect, it } from 'vitest';
import { ModelRuntime } from '../ModelRuntime';
import assets from '../../desktop-resources/assets-lock.json';

describe('identidade do modelo candidato', () => {
  it.each([
    { ...assets.model, name: '../modelo.gguf' },
    { ...assets.model, sha256: 'identidade-invalida' },
    { ...assets.model, size: -1 },
  ])('recusa caminhos e identidades inválidos sem abrir um processo', (model) => {
    expect(() => new ModelRuntime('recursos', 512, 16 * 1024 ** 3, model)).toThrow();
  });
});

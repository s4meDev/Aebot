import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLocalEnvironment } from '../environment';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aebot-env-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('ambiente local do backend', () => {
  it('carrega .env.local fora de produção sem expor seu conteúdo', () => {
    const directory = temporaryDirectory();
    const filePath = path.join(directory, '.env.local');
    fs.writeFileSync(filePath, 'GEMINI_API_KEY=teste\n');
    const loader = vi.fn();

    expect(loadLocalEnvironment({ cwd: directory, env: {}, loadEnvFile: loader })).toBe(true);
    expect(loader).toHaveBeenCalledWith(filePath);
  });

  it('não exige arquivo local e nunca o carrega em produção', () => {
    const directory = temporaryDirectory();
    fs.writeFileSync(path.join(directory, '.env.local'), 'GEMINI_API_KEY=teste\n');
    const loader = vi.fn();

    expect(loadLocalEnvironment({ cwd: directory, env: {}, loadEnvFile: loader })).toBe(true);
    loader.mockClear();
    expect(loadLocalEnvironment({
      cwd: directory,
      env: { NODE_ENV: 'production' },
      loadEnvFile: loader,
    })).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    expect(loadLocalEnvironment({ cwd: temporaryDirectory(), env: {}, loadEnvFile: loader })).toBe(false);
  });
});

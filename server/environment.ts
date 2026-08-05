import fs from 'node:fs';
import path from 'node:path';

export interface EnvironmentLoadOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  loadEnvFile?: (filePath: string) => void;
}

/**
 * Carrega `.env.local` somente fora de produção. O arquivo é ignorado pelo Git
 * e permite executar o backend local sem colocar a chave no bundle da extensão.
 */
export function loadLocalEnvironment(options: EnvironmentLoadOptions = {}): boolean {
  const env = options.env ?? process.env;
  if (env.NODE_ENV === 'production') return false;

  const cwd = options.cwd ?? process.cwd();
  const configuredPath = env.AEBOT_ENV_FILE?.trim();
  const filePath = path.resolve(cwd, configuredPath || '.env.local');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  const loader = options.loadEnvFile ?? process.loadEnvFile.bind(process);
  loader(filePath);
  return true;
}

import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Roda o cenário pesado sozinho para não misturar o tempo com os demais testes.
const vitestPath = path.resolve(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(
  process.execPath,
  [vitestPath, 'run', 'worker/__tests__/capacity.test.ts'],
  {
    cwd: process.cwd(),
    env: { ...process.env, AEBOT_RUN_CAPACITY: 'true' },
    stdio: 'inherit',
  }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

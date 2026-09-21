import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { availableParallelism } from 'node:os';

export class ModelRuntime {
  private child?: ChildProcess;
  private connectionValue: { url: string; token: string } | null = null;
  private generation = 0;
  state: 'starting' | 'ready' | 'unavailable' = 'unavailable';
  message = 'IA local ainda não iniciada.';

  constructor(private readonly resources: string) {}
  connection = () => this.connectionValue;

  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    const executable = path.join(this.resources, 'runtime', 'llama-server.exe');
    const model = path.join(this.resources, 'models', 'Qwen3-4B-Q4_K_M.gguf');
    if (!existsSync(executable) || !existsSync(model)) {
      this.message = 'Pacote de IA incompleto. Solicite à TI o instalador com runtime e modelo Qwen.';
      return;
    }
    this.state = 'starting';
    this.message = 'Carregando a IA neste computador…';
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const probe = createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
          const address = probe.address();
          probe.close(() => typeof address === 'object' && address ? resolve(address.port) : reject(new Error('port')));
        });
      });
      if (generation !== this.generation) return;
      const token = randomBytes(32).toString('hex');
      const child = spawn(executable, ['--model', model, '--host', '127.0.0.1', '--port', String(port),
        '--ctx-size', '16384', '--parallel', '1', '--threads', String(Math.max(1, Math.min(6, availableParallelism() - 2))),
        '--n-gpu-layers', '0', '--no-webui', '--jinja', '--log-disable'], {
        windowsHide: true, stdio: 'ignore', shell: false,
        env: { ...process.env, LLAMA_API_KEY: token },
      });
      this.child = child;
      const failed = () => {
        if (generation !== this.generation) return;
        this.connectionValue = null; this.state = 'unavailable';
        this.message = 'Não foi possível carregar a IA local. Verifique memória e pacote instalado ou tente reiniciar a IA.';
      };
      child.once('error', failed);
      child.once('exit', failed);
      const url = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline && generation === this.generation && this.state === 'starting') {
        try {
          const response = await fetch(`${url}/health`, {
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1500), redirect: 'error',
          });
          if (response.ok && generation === this.generation && this.state === 'starting') {
            this.connectionValue = { url, token }; this.state = 'ready';
            this.message = 'Qwen local pronto. As perguntas permanecem neste computador.';
            return;
          }
        } catch { /* O carregamento pode demorar em CPU. */ }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (generation === this.generation) {
        this.stop(); this.message = 'O carregamento da IA excedeu dois minutos. Tente reiniciar a IA nas configurações.';
      }
    } catch {
      if (generation === this.generation) { this.stop(); this.message = 'Falha ao iniciar o runtime local.'; }
    }
  }

  stop(): void {
    this.generation += 1;
    this.connectionValue = null; this.state = 'unavailable';
    this.child?.kill(); this.child = undefined;
  }
}

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { availableParallelism, totalmem } from 'node:os';
import assetsLock from '../desktop-resources/assets-lock.json';
import { verifyModelIntegrity } from './ModelIntegrity';

/** Em 8 GB, uma janela menor evita reservar memória de atenção que não será usada. */
export function runtimeResourceProfile(memoryBytes: number) {
  if (!Number.isFinite(memoryBytes) || memoryBytes <= 0) throw new Error('Memória física inválida.');
  return Object.freeze({ contextTokens: memoryBytes < 12 * 1024 ** 3 ? 8192 : 16384, kvCache: 'q8_0',
    flashAttention: 'on', cacheRamMiB: 0, batchTokens: 512, microBatchTokens: 128, warmup: false });
}

export class ModelRuntime {
  /** Configuração fixa e registrada nas avaliações, para comparar memória e latência. */
  readonly resourceProfile: ReturnType<typeof runtimeResourceProfile>;
  private child?: ChildProcess;
  private connectionValue: { url: string; token: string } | null = null;
  // Impede que uma inicialização antiga publique conexão depois de um reinício.
  private generation = 0;
  state: 'starting' | 'ready' | 'unavailable' = 'unavailable';
  message = 'IA local ainda não iniciada.';

  constructor(private readonly resources: string, private readonly reasoningBudget = 512, memoryBytes = totalmem(),
    private readonly modelAsset: { name: string; sha256: string; size: number } = assetsLock.model,
    private readonly slotDirectory = path.join(resources, 'catalog-cache')) {
    if (!/^[\w.-]+\.gguf$/.test(modelAsset.name) || !/^[a-f0-9]{64}$/.test(modelAsset.sha256) ||
        !Number.isSafeInteger(modelAsset.size) || modelAsset.size <= 0) throw new Error('Identidade do modelo inválida.');
    this.resourceProfile = runtimeResourceProfile(memoryBytes);
    if (!Number.isSafeInteger(reasoningBudget) || reasoningBudget < 32 || reasoningBudget > 512) {
      throw new Error('O orçamento de raciocínio deve estar entre 32 e 512 tokens.');
    }
  }
  connection = () => this.connectionValue;

  async start(): Promise<void> {
    // Não abre um segundo processo se o Windows não deixou encerrar o anterior.
    if (!this.stop()) return;
    const generation = this.generation;
    // A versão nova fica ao lado da antiga, sem sobrescrever um runtime em uso.
    const executable = path.join(this.resources, assetsLock.runtime.directory, 'llama-server.exe');
    const model = path.join(this.resources, 'models', this.modelAsset.name);
    if (!existsSync(executable) || !existsSync(model)) {
      this.message = 'Pacote de IA incompleto. Solicite à TI o instalador com runtime e modelo Qwen.';
      return;
    }
    this.state = 'starting';
    this.message = 'Conferindo o modelo e carregando a IA neste computador…';
    try {
      try { await verifyModelIntegrity(model, this.modelAsset); }
      catch {
        if (generation === this.generation) {
          this.state = 'unavailable';
          this.message = 'Modelo ausente ou corrompido. Solicite à TI a reinstalação do pacote completo.';
        }
        return;
      }
      if (generation !== this.generation) return;
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
      // A porta é privada deste processo; não é o backend online legado.
      const child = spawn(executable, ['--model', model, '--host', '127.0.0.1', '--port', String(port),
        '--ctx-size', String(this.resourceProfile.contextTokens), '--no-context-shift', '--no-warmup',
        // Não roda benchmark sintético na abertura. A leitura pública preparada
        // pode ser restaurada depois, sem salvar perguntas do analista.
        '--parallel', '1', '--threads', String(Math.max(1, Math.min(6, availableParallelism() - 2))),
        // Reduz a memória da atenção. Relato longo demais deve falhar, não ser cortado silenciosamente.
        // Sem cache de slots antigos: não duplicar prompts grandes na RAM do notebook.
        '--flash-attn', this.resourceProfile.flashAttention,
        '--cache-type-k', this.resourceProfile.kvCache, '--cache-type-v', this.resourceProfile.kvCache,
        '--cache-ram', String(this.resourceProfile.cacheRamMiB),
        '--batch-size', String(this.resourceProfile.batchTokens), '--ubatch-size', String(this.resourceProfile.microBatchTokens),
        ...(existsSync(this.slotDirectory) ? ['--slot-save-path', path.resolve(this.slotDirectory)] : []),
        '--n-gpu-layers', '0', '--no-webui', '--jinja', '--log-disable',
        '--reasoning-format', 'deepseek', '--reasoning-budget', String(this.reasoningBudget)], {
        windowsHide: true, stdio: 'ignore', shell: false,
        env: { ...process.env, LLAMA_API_KEY: token },
      });
      this.child = child;
      const failed = () => {
        if (generation !== this.generation) return;
        this.connectionValue = null; this.state = 'unavailable';
        this.message = 'O processo de IA local falhou ou encerrou. Solicite à TI a verificação do runtime e de suas dependências.';
      };
      child.once('error', failed);
      child.once('exit', (code: number | null) => {
        failed();
        // O Windows pode devolver NTSTATUS com ou sem sinal. Esse código confirma
        // recusa pela política de integridade; reinstalar o mesmo arquivo não a corrige.
        if (generation === this.generation && code !== null && (code >>> 0) === 0xc0e90002) {
          this.message = 'O Windows bloqueou um componente da IA por política de segurança (0xC0E90002). Solicite à TI um pacote com assinatura confiável; não desative a proteção.';
        }
      });
      const url = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 120_000;
      let lastHealthStatus: number | undefined;
      while (Date.now() < deadline && generation === this.generation && this.state === 'starting') {
        try {
          const response = await fetch(`${url}/health`, {
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1500), redirect: 'error',
          });
          lastHealthStatus = response.status;
          if ((response.status === 401 || response.status === 403) && generation === this.generation && this.state === 'starting') {
            if (this.stop()) this.message = 'O runtime local recusou a credencial temporária. Solicite suporte; não desative a autenticação.';
            return;
          }
          if (response.ok && generation === this.generation && this.state === 'starting') {
            this.connectionValue = { url, token }; this.state = 'ready';
            this.message = 'Qwen local pronto. As perguntas permanecem neste computador.';
            return;
          }
        } catch { /* O carregamento pode demorar em CPU. */ }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (generation === this.generation && this.state === 'starting') {
        if (this.stop()) {
          // Distingue processo sem resposta de modelo que ainda estava carregando.
          // Não atribui a falha à memória ou ao antivírus sem evidência.
          this.message = lastHealthStatus === undefined
            ? 'O runtime de IA não respondeu no endereço local em dois minutos. Solicite à TI a verificação do executável, dependências e acesso ao loopback.'
            : lastHealthStatus === 503
              ? 'O runtime respondeu, mas o modelo não terminou de carregar em dois minutos. Verifique os recursos disponíveis com o suporte.'
              : `O runtime respondeu com HTTP ${lastHealthStatus}, mas não ficou pronto. Solicite suporte.`;
        }
      }
    } catch {
      if (generation === this.generation && this.stop()) this.message = 'Falha ao iniciar o runtime local.';
    }
  }

  stop(): boolean {
    // Invalida as esperas em andamento antes de encerrar o processo filho.
    this.generation += 1;
    this.connectionValue = null; this.state = 'unavailable';
    const child = this.child;
    if (!child) return true;
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      try {
        if (!child.kill()) throw new Error('Encerramento não confirmado');
      } catch {
        // Mantém a referência e bloqueia outro carregamento. Não tenta matar
        // processos por nome nem usa um comando mais forte para contornar o Windows.
        this.message = 'Não foi possível encerrar o processo de IA anterior. Solicite suporte antes de reiniciar a IA.';
        return false;
      }
    }
    this.child = undefined;
    return true;
  }
}

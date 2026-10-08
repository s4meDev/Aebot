import { EventEmitter } from 'node:events';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelRuntime } from '../ModelRuntime';
import assetsLock from '../../desktop-resources/assets-lock.json';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), exists: vi.fn(), integrity: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('node:fs', () => ({ existsSync: mocks.exists }));
vi.mock('../ModelIntegrity', () => ({ verifyModelIntegrity: mocks.integrity }));
vi.mock('node:net', () => ({ createServer: () => ({
  once: vi.fn(), listen: (_port: number, _host: string, ready: () => void) => ready(),
  address: () => ({ port: 12345 }), close: (closed: () => void) => closed(),
}) }));

// Simula só o ciclo de vida do processo. Estes testes não medem o Qwen real.
class TestChild extends EventEmitter {
  pid = 42;
  exitCode: number | null = null;
  signalCode: string | null = null;
  kill = vi.fn(() => true);
}

describe('inicialização e diagnóstico do runtime', () => {
  let child: TestChild;
  let health: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    child = new TestChild();
    mocks.spawn.mockReturnValue(child);
    mocks.exists.mockReturnValue(true);
    mocks.integrity.mockResolvedValue(undefined);
    health = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', health);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('publica apenas loopback autenticado depois da resposta de saúde', async () => {
    const runtime = new ModelRuntime('recursos');
    await runtime.start();
    expect(runtime.state).toBe('ready');
    expect(runtime.connection()?.url).toBe('http://127.0.0.1:12345');
    const token = runtime.connection()?.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(health.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(mocks.spawn.mock.calls[0][0]).toBe(path.join('recursos', assetsLock.runtime.directory, 'llama-server.exe'));
    const options = mocks.spawn.mock.calls[0][2];
    expect(mocks.spawn.mock.calls[0][1]).toContain('--no-warmup');
    expect(options.env.LLAMA_API_KEY).toBe(token);
    expect(options).toMatchObject({ shell: false, windowsHide: true, stdio: 'ignore' });
    expect(runtime.stop()).toBe(true);
    expect(runtime.connection()).toBeNull();
  });

  it('não inicia com pacote incompleto ou modelo corrompido', async () => {
    const runtime = new ModelRuntime('recursos');
    mocks.exists.mockReturnValue(false);
    await runtime.start();
    expect(runtime.message).toContain('incompleto');
    mocks.exists.mockReturnValue(true);
    mocks.integrity.mockRejectedValue(new Error('teste'));
    await runtime.start();
    expect(runtime.message).toContain('corrompido');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it.each(['exit', 'error'])('preserva falha do processo (%s) em vez de dizer que demorou', async (event) => {
    health.mockImplementation(async () => {
      child.emit(event, event === 'error' ? new Error('teste') : 1);
      return { status: 200, ok: true };
    });
    const runtime = new ModelRuntime('recursos');
    const startup = runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    await startup;
    expect(runtime.state).toBe('unavailable');
    expect(runtime.connection()).toBeNull();
    expect(runtime.message).toContain('falhou ou encerrou');
  });

  it.each([401, 403])('não tenta contornar autenticação recusada (%s)', async (status) => {
    health.mockResolvedValue({ status, ok: false });
    const runtime = new ModelRuntime('recursos');
    await runtime.start();
    expect(runtime.message).toContain('credencial temporária');
    expect(runtime.connection()).toBeNull();
    expect(child.kill).toHaveBeenCalledOnce();
    expect(health).toHaveBeenCalledOnce();
  });

  it.each([0xc0e90002, 0xc0e90002 | 0])('identifica bloqueio do Windows, inclusive código com sinal (%s)', async (code) => {
    health.mockImplementation(async () => { child.emit('exit', code); return { status: 200, ok: true }; });
    const runtime = new ModelRuntime('recursos');
    const startup = runtime.start();
    await vi.advanceTimersByTimeAsync(500);
    await startup;
    expect(runtime.state).toBe('unavailable');
    expect(runtime.message).toContain('0xC0E90002');
    expect(runtime.message).toContain('não desative');
    expect(runtime.connection()).toBeNull();
  });

  it.each([
    [undefined, 'não respondeu no endereço local'],
    [503, 'modelo não terminou de carregar'],
    [500, 'HTTP 500'],
  ])('distingue o motivo observado na espera (%s)', async (status, expected) => {
    if (status === undefined) health.mockRejectedValue(new Error('teste'));
    else health.mockResolvedValue({ status, ok: false });
    const runtime = new ModelRuntime('recursos');
    const startup = runtime.start();
    await vi.advanceTimersByTimeAsync(120_000);
    await startup;
    expect(runtime.message).toContain(expected);
    expect(runtime.state).toBe('unavailable');
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it('bloqueia novo carregamento quando o processo anterior não aceita encerramento', async () => {
    const runtime = new ModelRuntime('recursos');
    await runtime.start();
    child.kill.mockReturnValue(false);
    await runtime.start();
    expect(runtime.message).toContain('Não foi possível encerrar');
    expect(runtime.connection()).toBeNull();
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });

  it('não substitui o diagnóstico de encerramento recusado pelo de timeout', async () => {
    health.mockRejectedValue(new Error('teste'));
    child.kill.mockImplementation(() => { throw new Error('teste'); });
    const runtime = new ModelRuntime('recursos');
    const startup = runtime.start();
    await vi.advanceTimersByTimeAsync(120_000);
    await startup;
    expect(runtime.message).toContain('Não foi possível encerrar');
  });

  it('ignora resposta atrasada depois de parar e não publica conexão antiga', async () => {
    let resolveHealth!: (value: unknown) => void;
    health.mockImplementation(() => new Promise((resolve) => { resolveHealth = resolve; }));
    const runtime = new ModelRuntime('recursos');
    const startup = runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    runtime.stop();
    resolveHealth({ status: 200, ok: true });
    await vi.advanceTimersByTimeAsync(500);
    await startup;
    expect(runtime.connection()).toBeNull();
    expect(runtime.state).toBe('unavailable');
  });
});

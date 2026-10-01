import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  start: vi.fn(), stop: vi.fn(), analyze: vi.fn(), write: vi.fn(), ready: false,
  reports: [] as Array<{ file: string; data: Record<string, unknown> }>,
}));
vi.mock('../ModelRuntime', () => ({ ModelRuntime: class {
  state = 'unavailable';
  message = 'Runtime não respondeu no teste.';
  connection = () => null;
  async start() { await mocks.start(); if (mocks.ready) this.state = 'ready'; }
  stop = mocks.stop;
} }));
vi.mock('../LocalModelClient', () => ({ LocalModelClient: class { cacheKey = 'perfil-teste'; } }));
vi.mock('../LocalData', () => ({ atomicJson: mocks.write }));
vi.mock('node:fs/promises', () => ({ readFile: async () => 'avaliador-de-teste' }));
vi.mock('../../src/services/AnalysisService', () => ({ AebotAnalysisService: class { analyze = mocks.analyze; } }));
vi.mock('../../src/services/RuleEngine', () => ({ ruleEngine: {
  getRuleStoreVersion: () => 'versão-teste', getRulesForService: () => [],
} }));

describe('registro da rodada desde a inicialização', () => {
  let previousArgv: string[];
  let previousExitCode: typeof process.exitCode;
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    previousArgv = process.argv; previousExitCode = process.exitCode;
    process.argv = ['node', 'evaluate', '--offset=66', '--limit=2'];
    process.exitCode = undefined;
    mocks.ready = false; mocks.reports = [];
    mocks.start.mockResolvedValue(undefined);
    mocks.write.mockImplementation(async (file: string, data: Record<string, unknown>) => {
      // Copia no momento da escrita, como o JSON no disco; o array vivo muda depois.
      mocks.reports.push({ file, data: structuredClone(data) });
    });
    mocks.analyze.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.argv = previousArgv; process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  });

  it('substitui o relatório antigo antes de iniciar e salva falha sem inferência', async () => {
    mocks.start.mockImplementation(async () => {
      expect(mocks.reports.at(-1)?.data.status).toBe('starting');
    });
    await import('../evaluate');
    const latest = mocks.reports.at(-1)!;
    expect(latest.file).toBe('desktop-release/local-evaluation.json');
    expect(latest.data).toMatchObject({ status: 'failed', completed: false, rows: [],
      failure: { phase: 'startup' }, summary: { evaluated: 0, modelCalls: 0 },
      environment: { freeMemoryBytesAfterStartup: null } });
    expect(mocks.reports[0].file).toMatch(/^desktop-release\/evaluations\//);
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
  });

  it('preserva os casos concluídos quando a análise seguinte falha, sem expor a exceção', async () => {
    mocks.ready = true;
    mocks.analyze.mockResolvedValueOnce({ decision: null, provider: 'simulated', evaluation: {
      matchedRules: [], outcome: 'insufficient',
    } }).mockRejectedValue(new Error('CONTEUDO_QUE_NAO_DEVE_IR_AO_RELATORIO'));
    await import('../evaluate');
    const latest = mocks.reports.at(-1)!.data;
    expect(latest).toMatchObject({ status: 'failed', completed: false, failure: { phase: 'evaluation' },
      summary: { evaluated: 1 }, expectedCases: 2 });
    expect(JSON.stringify(mocks.reports)).not.toContain('CONTEUDO_QUE_NAO_DEVE_IR_AO_RELATORIO');
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
  });

  it('registra conclusão da execução mesmo quando há divergência no gabarito', async () => {
    mocks.ready = true;
    mocks.analyze.mockResolvedValue({ decision: null, provider: 'simulated', evaluation: {
      matchedRules: [], outcome: 'insufficient',
    } });
    await import('../evaluate');
    expect(mocks.reports.at(-1)!.data).toMatchObject({ status: 'completed', completed: true,
      summary: { evaluated: 2, divergences: 2 }, operationalApproval: 'pending' });
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
  });

  it.each([false, true])('conclusão correta não oculta classificatória extra: %s', async (extra) => {
    process.argv = ['node', 'evaluate', '--offset=89', '--limit=1'];
    mocks.ready = true;
    mocks.analyze.mockResolvedValue({ decision: 'Não Conforme', provider: 'local', evaluation: {
      matchedRules: [{ id: 'RULE-PARAM-GERAL-01', severity: 'Não Conforme' },
        { id: 'orientação-consultada', severity: null },
        ...(extra ? [{ id: 'classificatória-indevida', severity: 'Reprovado' }] : [])], outcome: 'decision',
    } });
    await import('../evaluate');
    expect(mocks.reports.at(-1)!.data).toMatchObject({ status: 'completed', summary: {
      evaluated: 1, passed: extra ? 0 : 1, divergences: extra ? 1 : 0,
    } });
    expect(process.exitCode).toBe(extra ? 1 : undefined);
  });
});

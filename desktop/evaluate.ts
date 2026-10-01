import path from 'node:path';
import { availableParallelism, cpus, freemem, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluationProgress, type EvaluationRowMetrics, type EvaluationRunStatus } from './EvaluationSummary';
import assetsLock from '../desktop-resources/assets-lock.json';
import packageInfo from '../package.json';
import { atomicJson } from './LocalData';
import { ModelRuntime } from './ModelRuntime';
import { LocalModelClient } from './LocalModelClient';
import { AebotAnalysisService } from '../src/services/AnalysisService';
import { ruleEngine } from '../src/services/RuleEngine';
import cases from '../src/data/regressionCases.json';
import pilotCases from '../src/data/desktopPilotCases.json';
import type { AiMessage, AiModelAttempt } from '../src/types';
import type { StructuredModelClient } from '../src/ai/StructuredModelClient';

const budgetArg = process.argv.find((arg) => arg.startsWith('--thinking-budget='));
const reasoningBudget = budgetArg ? Number(budgetArg.split('=')[1]) : 512;
if (budgetArg && !process.argv.includes('--thinking')) throw new Error('Use --thinking junto do orçamento experimental.');
const runtime = new ModelRuntime(path.resolve('desktop-resources'), reasoningBudget);
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
const offset = offsetArg ? Number(offsetArg.split('=')[1]) : 0;
const pilot = [...cases.filter((item) => item.serviceId === 'reparo-cavalete'),
  ...pilotCases.map((item) => ({ ...item, serviceId: 'reparo-cavalete' }))];
const limit = limitArg ? Number(limitArg.split('=')[1]) : pilot.length;
if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0 || offset >= pilot.length) throw new Error('Limite ou início inválido.');
const selectedCases = pilot.slice(offset, offset + limit);
const rows: Array<EvaluationRowMetrics & Record<string, unknown>> = [];
const startedAt = new Date().toISOString();
const archiveFile = `desktop-release/evaluations/${startedAt.replace(/[:.]/g, '-')}.json`;
const startupStarted = Date.now();
let startupMs: number | null = null;
let phase: 'startup' | 'evaluation' = 'startup';
const modelClient = new LocalModelClient(runtime.connection, { thinking: process.argv.includes('--thinking'), reasoningBudget });
// Registra configuração técnica, nunca usuário, nome do computador ou conversas reais.
const environment = { platform: process.platform, arch: process.arch, node: process.version,
  cpu: cpus()[0]?.model ?? 'desconhecida', logicalCpus: availableParallelism(),
  totalMemoryBytes: totalmem(), freeMemoryBytesBeforeStartup: freemem(),
  freeMemoryBytesAfterStartup: null as number | null };
const corpusSha256 = createHash('sha256').update(JSON.stringify(selectedCases)).digest('hex');
// O bundle inclui o motor e a base usados: distingue builds da mesma versão.
const evaluatorSha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
async function checkpoint(status: EvaluationRunStatus, failure?: { phase: typeof phase; message: string }) {
  const report = {
    generatedAt: new Date().toISOString(), startedAt, model: 'Qwen3-4B-Q4_K_M', offset,
    appVersion: packageInfo.version, runtimeVersion: assetsLock.runtime.version,
    modelSha256: assetsLock.model.sha256, corpusSha256, evaluatorSha256, environment, startupMs,
    ...evaluationProgress(rows, selectedCases.length, status), failure,
    profile: modelClient.cacheKey, ruleVersion: ruleEngine.getRuleStoreVersion(), operationalApproval: 'pending',
    note: '100 casos técnicos propostos (66 regressões existentes e 34 cenários do piloto). Validação da referência operacional ainda necessária.', rows,
  };
  await atomicJson(archiveFile, report);
  await atomicJson('desktop-release/local-evaluation.json', report);
}
try {
  // Substitui o relatório "mais recente" antes de abrir o runtime. Se o processo
  // for interrompido, a rodada fica incompleta, sem parecer um sucesso antigo.
  await checkpoint('starting');
  await runtime.start();
  startupMs = Date.now() - startupStarted;
  if (runtime.state !== 'ready') throw new Error(runtime.message);
  environment.freeMemoryBytesAfterStartup = freemem();
  phase = 'evaluation';
  await checkpoint('running');
  // Diagnóstico opt-in exclusivo deste corpus sintético. Não imprime resposta
  // natural, raciocínio ou credenciais e não faz parte do aplicativo do analista.
  const diagnosticClient: StructuredModelClient = {
    provider: modelClient.provider, providerChain: modelClient.providerChain,
    modelChain: modelClient.modelChain, cacheKey: modelClient.cacheKey,
    async request(contents, instruction, limit, options) {
      if (!process.argv.includes('--inspect-facts')) return modelClient.request(contents, instruction, limit, options);
      return modelClient.request(contents, instruction, limit, { ...options, validateText(text) {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          console.log('Fatos do corpus sintético:', JSON.stringify({
            intent: parsed.intent, evidence: parsed.evidence, mappings: parsed.mappings,
          }));
        } catch { /* O contrato inválido já está registrado nos metadados da tentativa. */ }
        return options?.validateText?.(text) ?? true;
      } });
    },
  };
  const service = new AebotAnalysisService({ modelClient: diagnosticClient,
    humanizeDeterministicResponses: false });
  for (const [index, test] of selectedCases.entries()) {
    const started = Date.now();
    const history: AiMessage[] = [];
    const attempts: AiModelAttempt[] = [];
    if ('previous' in test && typeof test.previous === 'string') {
      const response = await service.analyze({ serviceId: test.serviceId, prompt: test.previous, history: [] });
      attempts.push(...(response.modelAttempts ?? []));
      history.push({ id: 'pilot-user', role: 'user', content: test.previous, timestamp: '09:00' },
        { id: 'pilot-assistant', role: 'assistant', content: response.content, timestamp: '09:01',
          pendingInformation: response.evaluation.followUpQuestion ? [response.evaluation.followUpQuestion] : undefined });
    }
    const result = await service.analyze({ serviceId: test.serviceId, prompt: test.query, history });
    attempts.push(...(result.modelAttempts ?? []));
    const matchedIds = new Set(result.evaluation.matchedRules.map((rule) => rule.id));
    const factGroups = ruleEngine.getRulesForService(test.serviceId)
      .filter((rule) => matchedIds.has(rule.id) && rule.factGroup).map((rule) => rule.factGroup!);
    const expectedGroups = 'expectedFactGroups' in test ? test.expectedFactGroups : undefined;
    const factsMatch = !expectedGroups || expectedGroups.length === factGroups.length &&
      expectedGroups.every((group) => factGroups.includes(group));
    // Acertar o rótulo usando uma classificatória indevida também é divergência.
    // Orientações consultadas não precisam desaparecer para essa conferência.
    const classifyingRuleIds = result.evaluation.matchedRules.filter((rule) => rule.severity !== null).map((rule) => rule.id);
    const expectedRuleIds = 'expectedClassifyingRuleIds' in test ? test.expectedClassifyingRuleIds : undefined;
    const rulesMatch = !expectedRuleIds || expectedRuleIds.length === classifyingRuleIds.length &&
      expectedRuleIds.every((id) => classifyingRuleIds.includes(id));
    const row = { caseIndex: offset + index, case: test.name, expected: test.decision, actual: result.decision,
      passed: result.decision === test.decision && factsMatch && rulesMatch,
      factGroups, expectedFactGroups: expectedGroups,
      classifyingRuleIds, expectedClassifyingRuleIds: expectedRuleIds,
      unsafeApproval: result.decision === 'Conforme' && test.decision !== 'Conforme',
      missedRejection: test.decision === 'Reprovado' && result.decision !== 'Reprovado',
      durationMs: Date.now() - started, provider: result.provider,
      attempts,
      outcome: result.evaluation.outcome,
      semanticApplied: result.evaluation.semanticInterpretationApplied === true,
      // Somente o corpus sintético de teste; nunca habilitar isto na telemetria do app.
      mappings: result.evaluation.semanticMappings,
      fallbackReason: result.fallbackReason, rules: result.evaluation.matchedRules.map((rule) => rule.id) };
    rows.push(row);
    console.log(`${index + 1}/${selectedCases.length}: ${row.passed ? 'OK' : 'DIVERGÊNCIA'} · ${row.durationMs} ms · ${row.provider}`);
    // Salva cada caso concluído: uma pausa não perde a rodada nem apaga as anteriores.
    await checkpoint(rows.length === selectedCases.length ? 'completed' : 'running');
  }
  if (rows.some((row) => !row.passed)) process.exitCode = 1;
} catch {
  startupMs ??= Date.now() - startupStarted;
  // Não inclui a exceção bruta: ela pode carregar prompt ou conteúdo do modelo.
  const message = phase === 'startup' ? runtime.message : 'A avaliação foi interrompida por uma falha técnica. Confira os casos concluídos.';
  await checkpoint('failed', { phase, message });
  console.error(`Avaliação não concluída (${phase}): ${message}`);
  process.exitCode = 1;
} finally { runtime.stop(); }

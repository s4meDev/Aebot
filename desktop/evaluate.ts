import path from 'node:path';
import { availableParallelism, cpus, freemem, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluationProgress, type EvaluationRowMetrics, type EvaluationRunStatus } from './EvaluationSummary';
import assetsLock from '../desktop-resources/assets-lock.json';
import modelCandidates from '../desktop-resources/model-candidates.json';
import packageInfo from '../package.json';
import { atomicJson } from './LocalData';
import { ModelRuntime } from './ModelRuntime';
import { PublicCatalogCache } from './PublicCatalogCache';
import { LocalModelClient, type LocalInferenceTimings } from './LocalModelClient';
import { AebotAnalysisService } from '../src/services/AnalysisService';
import { ruleEngine } from '../src/services/RuleEngine';
import cases from '../src/data/regressionCases.json';
import pilotCases from '../src/data/desktopPilotCases.json';
import asphaltCases from '../src/data/asphaltPilotCases.json';
import type { AiMessage, AiModelAttempt } from '../src/types';
import type { StructuredModelClient } from '../src/ai/StructuredModelClient';

const budgetArg = process.argv.find((arg) => arg.startsWith('--thinking-budget='));
const reasoningBudget = budgetArg ? Number(budgetArg.split('=')[1]) : 512;
const temperatureArg = process.argv.find(arg => arg.startsWith('--temperature='));
const temperature = temperatureArg ? Number(temperatureArg.split('=')[1]) : undefined;
if (budgetArg && !process.argv.includes('--thinking')) throw new Error('Use --thinking junto do orçamento experimental.');
// Só o avaliador permite escolher um candidato. O aplicativo usa o lock selecionado.
const candidateArg = process.argv.find((arg) => arg.startsWith('--candidate='));
const candidate = candidateArg?.split('=')[1];
if (candidate && !Object.hasOwn(modelCandidates, candidate)) throw new Error('Candidato não cadastrado.');
const modelAsset = candidate ? modelCandidates[candidate as keyof typeof modelCandidates] : assetsLock.model;
const modelName = modelAsset.name.replace(/\.gguf$/, '');
const runtime = new ModelRuntime(path.resolve('desktop-resources'), reasoningBudget, totalmem(), modelAsset);
const publicCatalog = new PublicCatalogCache(path.resolve('desktop-resources/catalog-cache'), runtime.connection,
  runtime.resourceProfile, modelAsset.sha256);
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
const offset = offsetArg ? Number(offsetArg.split('=')[1]) : 0;
const corpusArg = process.argv.find((arg) => arg.startsWith('--corpus='));
const corpus = corpusArg ? corpusArg.split('=')[1] : 'cavalete';
if (!['cavalete', 'asfalto'].includes(corpus)) throw new Error('Corpus inexistente. Use cavalete ou asfalto.');
// A seleção é explícita e cada caso conserva seu próprio serviceId.
const pilot = corpus === 'asfalto' ? asphaltCases : [...cases.filter((item) => item.serviceId === 'reparo-cavalete'),
  ...pilotCases.map((item) => ({ ...item, serviceId: 'reparo-cavalete' }))];
const limit = limitArg ? Number(limitArg.split('=')[1]) : pilot.length;
if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0 || offset >= pilot.length) throw new Error('Limite ou início inválido.');
const selectedCases = pilot.slice(offset, offset + limit);
const rows: Array<EvaluationRowMetrics & Record<string, unknown>> = [];
const inferenceTimings: LocalInferenceTimings[] = [];
const catalogRestores: number[] = [];
const startedAt = new Date().toISOString();
const archiveFile = `desktop-release/evaluations/${startedAt.replace(/[:.]/g, '-')}.json`;
const startupStarted = Date.now();
let startupMs: number | null = null;
let phase: 'startup' | 'evaluation' = 'startup';
const modelClient = new LocalModelClient(runtime.connection, { thinking: process.argv.includes('--thinking'), reasoningBudget, temperature,
  modelName, modelSha256: modelAsset.sha256, indexed: !process.argv.includes('--compact'),
  onTimings: (timings) => inferenceTimings.push(timings),
  prepareSystemPrefix: process.argv.includes('--prepared') ? async instruction => {
    const started = Date.now();
    if (await publicCatalog.restore(instruction)) catalogRestores.push(Date.now() - started);
  } : undefined });
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
    generatedAt: new Date().toISOString(), startedAt, model: modelName, candidate, offset, corpus,
    appVersion: packageInfo.version, runtimeVersion: assetsLock.runtime.version,
    modelSha256: modelAsset.sha256, corpusSha256, evaluatorSha256, environment, startupMs,
    ...evaluationProgress(rows, selectedCases.length, status), failure,
    profile: modelClient.cacheKey, interpretationProtocol: modelClient.localInterpretationProtocol,
    runtimeConfiguration: runtime.resourceProfile,
    publicCatalogEnabled: process.argv.includes('--prepared'),
    ruleVersion: ruleEngine.getRuleStoreVersion(), operationalApproval: 'pending',
    note: `${pilot.length} casos técnicos do corpus ${corpus}. Validação da referência operacional ainda necessária.`, rows,
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
    // O diagnóstico só observa a chamada: não pode mudar o contrato usado pelo aplicativo.
    localInterpretationProtocol: modelClient.localInterpretationProtocol,
    async request(contents, instruction, limit, options) {
      if (!process.argv.includes('--inspect-facts')) return modelClient.request(contents, instruction, limit, options);
      return modelClient.request(contents, instruction, limit, { ...options, validateText(text) {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          console.log('Fatos do corpus sintético:', JSON.stringify({
            intent: parsed.intent, evidence: parsed.evidence, mappings: parsed.mappings, indexedMappings: parsed.m,
            checks: Object.values(parsed).every(value => typeof value === 'boolean') ? parsed : undefined,
          }));
        } catch { /* O contrato inválido já está registrado nos metadados da tentativa. */ }
        return options?.validateText?.(text) ?? true;
      } });
    },
  };
  const service = new AebotAnalysisService({ modelClient: diagnosticClient,
    humanizeDeterministicResponses: false });
  for (const [index, test] of selectedCases.entries()) {
    inferenceTimings.length = 0;
    catalogRestores.length = 0;
    const started = Date.now();
    const history: AiMessage[] = [];
    const attempts: AiModelAttempt[] = [];
    if ('previous' in test && typeof test.previous === 'string') {
      const response = await service.analyze({ serviceId: test.serviceId, prompt: test.previous, history: [] });
      attempts.push(...(response.modelAttempts ?? []));
      history.push({ id: 'pilot-user', role: 'user', content: test.previous, timestamp: '09:00' },
        { id: 'pilot-assistant', role: 'assistant', content: response.content, timestamp: '09:01',
          // O avaliador precisa continuar o caso com o mesmo estado tipado usado no chat real.
          pendingInformation: response.evaluation.advisory?.missingInformation ??
            (response.evaluation.followUpQuestion ? [response.evaluation.followUpQuestion] : undefined) });
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
    // Consulta de regra classificatória não é aplicação de uma conclusão.
    // Casos negativos conferem ausência de aplicação sem exigir base consultada vazia.
    const appliedRuleIds = result.evaluation.outcome === 'decision' ? classifyingRuleIds : [];
    const expectedAppliedRuleIds = 'expectedAppliedRuleIds' in test ? test.expectedAppliedRuleIds : undefined;
    const expectedRuleIds = 'expectedClassifyingRuleIds' in test ? test.expectedClassifyingRuleIds : undefined;
    const rulesMatch = expectedAppliedRuleIds
      ? expectedAppliedRuleIds.length === appliedRuleIds.length && expectedAppliedRuleIds.every(id => appliedRuleIds.includes(id))
      : !expectedRuleIds || expectedRuleIds.length === classifyingRuleIds.length &&
        expectedRuleIds.every((id) => classifyingRuleIds.includes(id));
    // Um null causado por contrato inválido não comprova compreensão. Nos
    // negativos, também não vale acertar o rótulo associando outro assunto.
    const allowedSemanticRuleIds = 'allowedSemanticRuleIds' in test ? test.allowedSemanticRuleIds : undefined;
    const semanticRulesMatch = !allowedSemanticRuleIds || (result.evaluation.semanticMappings ?? [])
      .every((mapping) => allowedSemanticRuleIds.includes(mapping.ruleId));
    const interpretationValid = attempts.every((attempt) => attempt.status === 'ok') &&
      !['invalid_response', 'api_error', 'rate_limited'].includes(result.fallbackReason ?? '');
    const row = { caseIndex: offset + index, case: test.name, expected: test.decision, actual: result.decision,
      passed: result.decision === test.decision && factsMatch && rulesMatch && semanticRulesMatch && interpretationValid,
      interpretationValid, semanticRulesMatch, allowedSemanticRuleIds,
      factGroups, expectedFactGroups: expectedGroups,
      classifyingRuleIds, expectedClassifyingRuleIds: expectedRuleIds,
      appliedRuleIds, expectedAppliedRuleIds,
      unsafeApproval: result.decision === 'Conforme' && test.decision !== 'Conforme',
      missedRejection: test.decision === 'Reprovado' && result.decision !== 'Reprovado',
      durationMs: Date.now() - started, provider: result.provider,
      attempts,
      inferenceTimings: [...inferenceTimings],
      publicCatalogRestoreMs: [...catalogRestores],
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
} catch (error) {
  startupMs ??= Date.now() - startupStarted;
  // Não inclui a exceção bruta: ela pode carregar prompt ou conteúdo do modelo.
  const message = phase === 'startup' ? runtime.message : 'A avaliação foi interrompida por uma falha técnica. Confira os casos concluídos.';
  await checkpoint('failed', { phase, message });
  console.error(`Avaliação não concluída (${phase}): ${message}`);
  // Só classes de erro e posições no código. Nunca a mensagem da exceção,
  // credenciais, resposta ou conteúdo de uma conversa.
  if (process.argv.includes('--inspect-facts') && error instanceof Error) {
    console.error('Classe da falha técnica:', error.name);
    const positions = [...(error.stack ?? '').matchAll(/evaluate\.mjs:(\d+):(\d+)/g)].slice(0, 4)
      .map(match => `${match[1]}:${match[2]}`);
    console.error('Posições no avaliador compilado:', positions.join(', '));
  }
  process.exitCode = 1;
} finally { runtime.stop(); }

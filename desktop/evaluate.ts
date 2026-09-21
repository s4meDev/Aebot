import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { ModelRuntime } from './ModelRuntime';
import { LocalModelClient } from './LocalModelClient';
import { AebotAnalysisService } from '../src/services/AnalysisService';
import { ruleEngine } from '../src/services/RuleEngine';
import cases from '../src/data/regressionCases.json';
import pilotCases from '../src/data/desktopPilotCases.json';
import type { AiMessage } from '../src/types';

const runtime = new ModelRuntime(path.resolve('desktop-resources'));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
const offset = offsetArg ? Number(offsetArg.split('=')[1]) : 0;
const pilot = [...cases.filter((item) => item.serviceId === 'reparo-cavalete'),
  ...pilotCases.map((item) => ({ ...item, serviceId: 'reparo-cavalete' }))];
const limit = limitArg ? Number(limitArg.split('=')[1]) : pilot.length;
if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0 || offset >= pilot.length) throw new Error('Limite ou início inválido.');
try {
  await runtime.start();
  if (runtime.state !== 'ready') throw new Error(runtime.message);
  const service = new AebotAnalysisService({ modelClient: new LocalModelClient(runtime.connection),
    humanizeDeterministicResponses: false });
  const rows = [];
  for (const [index, test] of pilot.slice(offset, offset + limit).entries()) {
    const started = Date.now();
    const history: AiMessage[] = [];
    if ('previous' in test && typeof test.previous === 'string') {
      const response = await service.analyze({ serviceId: test.serviceId, prompt: test.previous, history: [] });
      history.push({ id: 'pilot-user', role: 'user', content: test.previous, timestamp: '09:00' },
        { id: 'pilot-assistant', role: 'assistant', content: response.content, timestamp: '09:01',
          pendingInformation: response.evaluation.followUpQuestion ? [response.evaluation.followUpQuestion] : undefined });
    }
    const result = await service.analyze({ serviceId: test.serviceId, prompt: test.query, history });
    const matchedIds = new Set(result.evaluation.matchedRules.map((rule) => rule.id));
    const factGroups = ruleEngine.getRulesForService(test.serviceId)
      .filter((rule) => matchedIds.has(rule.id) && rule.factGroup).map((rule) => rule.factGroup!);
    const expectedGroups = 'expectedFactGroups' in test ? test.expectedFactGroups : undefined;
    const factsMatch = !expectedGroups || expectedGroups.length === factGroups.length &&
      expectedGroups.every((group) => factGroups.includes(group));
    const row = { case: test.name, expected: test.decision, actual: result.decision,
      passed: result.decision === test.decision && factsMatch,
      factGroups, expectedFactGroups: expectedGroups,
      unsafeApproval: result.decision === 'Conforme' && test.decision !== 'Conforme',
      missedRejection: test.decision === 'Reprovado' && result.decision !== 'Reprovado',
      durationMs: Date.now() - started, provider: result.provider,
      semanticApplied: result.evaluation.semanticInterpretationApplied === true,
      // Somente o corpus sintético de teste; nunca habilitar isto na telemetria do app.
      mappings: result.evaluation.semanticMappings,
      fallbackReason: result.fallbackReason, rules: result.evaluation.matchedRules.map((rule) => rule.id) };
    rows.push(row);
    console.log(`${index + 1}/${Math.min(limit, pilot.length)}: ${row.passed ? 'OK' : 'DIVERGÊNCIA'} · ${row.durationMs} ms · ${row.provider}`);
  }
  await mkdir('desktop-release', { recursive: true });
  await writeFile('desktop-release/local-evaluation.json', JSON.stringify({
    generatedAt: new Date().toISOString(), model: 'Qwen3-4B-Q4_K_M', offset,
    ruleVersion: service.status().ruleStoreVersion,
    operationalApproval: 'pending',
    note: '100 casos técnicos propostos (66 regressões existentes e 34 cenários do piloto). Validação da referência operacional ainda necessária.', rows,
  }, null, 2));
  if (rows.some((row) => !row.passed)) process.exitCode = 1;
} finally { runtime.stop(); }

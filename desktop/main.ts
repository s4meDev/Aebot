import { app, BrowserWindow, dialog, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ModelRuntime } from './ModelRuntime';
import { LocalModelClient } from './LocalModelClient';
import { AebotAnalysisService } from '../src/services/AnalysisService';
import { RuleEngine } from '../src/services/RuleEngine';
import { parseAnalyzeRequest } from '../src/api/contracts';
import { parseFeedbackSubmission } from '../src/api/feedbackContracts';
import type { DesktopStatus } from '../src/desktop/contracts';
import { atomicJson, LocalData, preservePreviousRules, readJsonFile } from './LocalData';
import { parseRuleRelease } from './RuleRelease';
import { smokeDesktop } from './smoke';

app.setName('AEBOT');
let runtime: ModelRuntime;
let window: BrowserWindow | null = null;
if (!app.requestSingleInstanceLock()) app.quit();
else void app.whenReady().then(async () => {
  const resources = app.isPackaged ? path.join(process.resourcesPath, 'local-ai')
    : path.join(app.getAppPath(), 'desktop-resources');
  const userDirectory = app.getPath('userData');
  const rulesFile = path.join(userDirectory, 'rules-release.json');
  const data = new LocalData(userDirectory);
  await data.load();
  let engine = new RuleEngine();
  let rulesWarning: string | undefined;
  try {
    const release = parseRuleRelease(await readJsonFile(rulesFile));
    // Nunca regressa para um pacote mais antigo que a base embarcada.
    if (release.store.version !== engine.getRuleStoreVersion()) {
      parseRuleRelease(release, engine.getRuleStoreVersion());
    }
    engine = new RuleEngine(release.store);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') rulesWarning = 'Pacote local inválido ou antigo. Usando a base embarcada; revise com o responsável.';
  }
  runtime = new ModelRuntime(resources);
  const createAnalysis = () => new AebotAnalysisService({
    modelClient: new LocalModelClient(runtime.connection), humanizeDeterministicResponses: false,
  }, engine);
  let analysis = createAnalysis();
  let busy = false;
  const status = (): DesktopStatus => ({ state: runtime.state, message: runtime.message,
    model: 'Qwen3-4B · Q4_K_M · CPU', ruleVersion: engine.getRuleStoreVersion(), rulesWarning,
    analyses: data.summary.analyses, modelCalls: data.summary.modelCalls, modelErrors: data.summary.modelErrors,
    averageDurationMs: data.summary.analyses ? Math.round(data.summary.durationMs / data.summary.analyses) : null });
  const indexFile = path.join(app.getAppPath(), 'desktop-dist', 'ui', 'index.html');
  const indexUrl = pathToFileURL(indexFile).href;

  // Uma página externa, subframe ou popup não pode chamar a ponte privilegiada.
  const trusted = (event: IpcMainInvokeEvent) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== indexUrl) throw new Error('Origem não autorizada.');
  };
  const handle = (channel: string, callback: (value: unknown) => unknown) => {
    ipcMain.handle(channel, (event, value: unknown) => { trusted(event); return callback(value); });
  };
  handle('aebot:status', () => status());
  handle('aebot:catalog', () => ({ type: 'success', source: 'local',
    ruleStoreVersion: engine.getRuleStoreVersion(), warning: rulesWarning,
    services: engine.getServices().map((service) => ({ ...service, businessRules: engine.getRulesForService(service.id) })) }));
  handle('aebot:analyze', async (value) => {
    if (busy) throw new Error('Aguarde a análise atual terminar.');
    if (JSON.stringify(value).length > 32_768) throw new Error('Conversa muito longa. Inicie um novo caso.');
    const request = parseAnalyzeRequest(value);
    busy = true; const started = Date.now();
    try {
      const result = await analysis.analyze(request);
      await data.record(result, Date.now() - started).catch(() => { /* Métricas não bloqueiam a orientação. */ });
      const { modelAttempts: _attempts, ...publicResult } = result;
      return publicResult;
    } finally { busy = false; }
  });
  handle('aebot:restart', () => {
    if (busy) throw new Error('Aguarde a análise atual terminar.');
    void runtime.start(); return status();
  });
  handle('aebot:import-rules', async () => {
    if (busy) throw new Error('Aguarde a análise atual terminar.');
    const chosen = await dialog.showOpenDialog(window!, { title: 'Pacote de regras aprovado',
      properties: ['openFile'], filters: [{ name: 'Pacote AEBOT', extensions: ['json'] }] });
    if (chosen.canceled) return { changed: false, message: 'Importação cancelada.' };
    const release = parseRuleRelease(await readJsonFile(chosen.filePaths[0]), engine.getRuleStoreVersion());
    const confirm = await dialog.showMessageBox(window!, { type: 'question', buttons: ['Cancelar', 'Aplicar regras'],
      defaultId: 0, cancelId: 0, message: `Atualizar base para ${release.store.version}?`,
      detail: `Responsável declarado: ${release.owner}\nVigência: ${release.effectiveAt}\n${release.changes}\n\nUse apenas pacotes distribuídos pelo responsável. O nome declarado não é uma assinatura digital.` });
    if (confirm.response !== 1) return { changed: false, message: 'Importação cancelada.' };
    if (busy) throw new Error('Aguarde a análise atual terminar.');
    const nextEngine = new RuleEngine(release.store);
    await preservePreviousRules(rulesFile);
    await atomicJson(rulesFile, release);
    engine = nextEngine; analysis = createAnalysis(); rulesWarning = undefined;
    return { changed: true, message: `Base ${release.store.version} aplicada. Inicie um novo caso.` };
  });
  handle('aebot:feedback', async (value) => {
    const input = parseFeedbackSubmission(value);
    if (!engine.getServices().some((service) => service.id === input.serviceId)) throw new Error('Serviço inexistente.');
    return { feedbackId: await data.saveFeedback(input) };
  });
  handle('aebot:export', async () => {
    const chosen = await dialog.showSaveDialog(window!, { title: 'Exportar métricas e feedback voluntário',
      defaultPath: `AEBOT-piloto-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Relatório JSON', extensions: ['json'] }] });
    if (chosen.canceled || !chosen.filePath) return { saved: false };
    await atomicJson(chosen.filePath, { ...data.report(), appVersion: app.getVersion(),
      ruleVersion: engine.getRuleStoreVersion(), model: status().model });
    return { saved: true };
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // A interface só abre recursos empacotados. A inferência roda fora do renderer.
    callback({ cancel: !details.url.startsWith('file://') && !details.url.startsWith('devtools://') });
  });
  const smoke = !app.isPackaged && process.argv.includes('--aebot-smoke');
  window = new BrowserWindow({ width: 860, height: 900, minWidth: 420, minHeight: 600, show: !smoke,
    backgroundColor: '#090909', title: 'AEBOT · Análise local', autoHideMenuBar: true,
    webPreferences: { preload: path.join(app.getAppPath(), 'desktop-dist', 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  await window.loadFile(indexFile);
  if (smoke) await smokeDesktop(window);
  else void runtime.start();
});
app.on('second-instance', () => { window?.restore(); window?.focus(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => runtime?.stop());

import { app, type BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import asphaltCases from '../src/data/asphaltPilotCases.json';
import { validateSemanticSmokeCheck } from './SmokeSemanticCheck';
import type { DecisionType } from '../src/types';

/** QA sintético por flag explícita; pacote e desenvolvimento usam perfis isolados. */
export async function smokeDesktop(window: BrowserWindow, stopRuntime: () => boolean, packaged = false,
  realInference = packaged): Promise<void> {
  try {
    const semanticCase = asphaltCases.find(item => 'requiresSemantic' in item && item.requiresSemantic && !('previous' in item));
    if (!semanticCase) throw new Error('Corpus sem caso semântico para conferência do pacote.');
    const result = await window.webContents.executeJavaScript(`(async () => {
      const bridge = window.aebotDesktop;
      if (!bridge || typeof require !== 'undefined') throw new Error('Isolamento da interface inválido');
      const catalog = await bridge.catalog();
      if (!catalog.services?.length) throw new Error('Catálogo vazio');
      const result = await bridge.analyze({ serviceId: catalog.services[0].id,
        prompt: 'sem foto depois', history: [] });
      if (result.decision !== 'Reprovado') throw new Error('Regressão de decisão');
      // Confere o novo serviço também pela ponte real, não só por chamada do motor.
      const asphalt = catalog.services.find(service => service.id === 'repavimentacao-asfalto-ate-1m2');
      if (!asphalt) throw new Error('Asfalto ausente do catálogo');
      const asphaltResult = await bridge.analyze({ serviceId: asphalt.id,
        prompt: 'Sem foto antes nem durante.', history: [] });
      if (asphaltResult.decision !== 'Reprovado' ||
          !asphaltResult.evaluation.primaryRule?.supportingRuleIds?.length) throw new Error('Regressão de combinação no Asfalto');
      let semanticCheck = null;
      if (${JSON.stringify(realInference)}) {
        // O teste com IA usa a primeira paráfrase do corpus público, sem histórico.
        // Assim também confere IA real + restauração, não só matching lexical.
        const test = ${JSON.stringify(semanticCase)};
        const before = await bridge.status();
        const started = performance.now();
        const checked = await bridge.analyze({ serviceId: test.serviceId, prompt: test.query, history: [] });
        const after = await bridge.status();
        const ids = checked.evaluation.matchedRules.filter(rule => rule.severity !== null).map(rule => rule.id);
        // Tentativas internas são retiradas da resposta pelo processo principal.
        // Não amplio o IPC só para testar: uso contadores públicos antes/depois.
        semanticCheck = { decision: checked.decision, provider: checked.provider, ruleIds: ids,
          semanticApplied: checked.evaluation.semanticInterpretationApplied === true, fallbackReason: checked.fallbackReason,
          durationMs: Math.round(performance.now() - started), calls: after.modelCalls - before.modelCalls,
          errors: after.modelErrors - before.modelErrors };
      }
      // Seleciona na interface para a captura mostrar o protótipo certo.
      const until = Date.now() + 5000;
      while (!document.querySelector('.service-select-trigger') && Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      document.querySelector('.service-select-trigger')?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const option = [...document.querySelectorAll('.service-option')].find(item => item.textContent.includes(asphalt.name));
      if (!option) throw new Error('Opção de Asfalto não apareceu na interface');
      option.click();
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!document.querySelector('.service-select-trigger')?.textContent.includes(asphalt.name)) throw new Error('Seleção não foi aplicada');
      // A pergunta sugerida percorre a interface e a ponte, sem chamada ao modelo.
      document.querySelector('.suggestion-chip')?.click();
      const responseUntil = Date.now() + 5000;
      while (!document.querySelector('.chat-badge.reprovado') && Date.now() < responseUntil) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!document.querySelector('.chat-badge.reprovado')) throw new Error('Resposta não apareceu no chat de Asfalto');
      return { services: catalog.services.length, ruleVersion: catalog.ruleStoreVersion,
        decision: result.decision, asphaltDecision: asphaltResult.decision, semanticCheck,
        asphaltRule: asphaltResult.evaluation.primaryRule.id, chatDecision: 'Reprovado', bridge: true, nodeDisabled: true };
    })()`);
    if (realInference) result.semanticCheck = validateSemanticSmokeCheck(result.semanticCheck, {
      decision: semanticCase.decision as DecisionType | null, ruleIds: semanticCase.expectedClassifyingRuleIds ?? [] });
    await mkdir('desktop-release', { recursive: true });
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (process.argv.includes('--aebot-smoke-visual')) {
      await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    }
    const selectedService = await window.webContents.executeJavaScript(`document.querySelector('.service-select-copy strong')?.textContent`);
    if (selectedService !== 'Repavimentação - Asfalto Até 1m²') throw new Error('Seleção mudou antes da captura');
    const runtime = await window.webContents.executeJavaScript('window.aebotDesktop.status()');
    await writeFile(`desktop-release/${packaged ? 'packaged' : 'desktop'}-smoke.json`, JSON.stringify({
      ...result, selectedService, packaged, status: 'running', model: runtime.model, runtimeState: runtime.state,
      testedAt: new Date().toISOString() }, null, 2));
    await writeFile(`desktop-release/${packaged ? 'packaged' : 'desktop'}-preview.png`, (await window.webContents.capturePage()).toPNG());
    if (process.argv.includes('--aebot-smoke-visual')) {
      // Confere a abertura e o seletor na largura mínima, sem depender só de CSS compilado.
      await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Iniciar novo caso"]')?.click()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const intro = await window.webContents.executeJavaScript(`Boolean(document.querySelector('.conversation-intro'))`);
      if (!intro) throw new Error('Novo caso não voltou à abertura');
      await writeFile('desktop-release/desktop-welcome.png', (await window.webContents.capturePage()).toPNG());
      window.setContentSize(420, 780);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const menu = await window.webContents.executeJavaScript(`(async () => {
        document.querySelector('.service-select-trigger').click();
        await new Promise(resolve => setTimeout(resolve, 150));
        const box = document.querySelector('.service-menu').getBoundingClientRect();
        const item = document.querySelector('.service-option-copy strong');
        return { left: box.left, right: box.right, width: innerWidth,
          documentWidth: document.documentElement.scrollWidth, color: getComputedStyle(item).color };
      })()`);
      if (menu.left < 0 || menu.right > menu.width || menu.documentWidth > menu.width || menu.color === 'rgba(0, 0, 0, 0)') {
        throw new Error('Seletor ilegível ou fora da janela mínima');
      }
      await writeFile('desktop-release/desktop-mobile-menu.png', (await window.webContents.capturePage()).toPNG());
    }
    console.log('Desktop validado: renderer isolado, ponte IPC, catálogo e análise local.');
    if (!stopRuntime()) throw new Error('O runtime do teste não encerrou.');
    await writeFile(`desktop-release/${packaged ? 'packaged' : 'desktop'}-smoke.json`, JSON.stringify({
      ...result, selectedService, packaged, status: 'completed', model: runtime.model, runtimeState: runtime.state,
      testedAt: new Date().toISOString() }, null, 2));
    app.exit(0);
  } catch (error) {
    // Só usa entradas sintéticas deste teste; nenhum conteúdo de analista é executado aqui.
    console.error('Falha no teste do desktop:', error instanceof Error ? error.message : 'erro desconhecido');
    stopRuntime();
    await writeFile(`desktop-release/${packaged ? 'packaged' : 'desktop'}-smoke.json`, JSON.stringify({
      status: 'failed', packaged, testedAt: new Date().toISOString(), message: 'QA sintético não concluído.' }, null, 2))
      .catch(() => undefined);
    app.exit(1);
  }
}

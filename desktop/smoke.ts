import { app, type BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';

/** Teste do aplicativo real, habilitado apenas em desenvolvimento por flag explícita. */
export async function smokeDesktop(window: BrowserWindow): Promise<void> {
  try {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const bridge = window.aebotDesktop;
      if (!bridge || typeof require !== 'undefined') throw new Error('Isolamento da interface inválido');
      const catalog = await bridge.catalog();
      if (!catalog.services?.length) throw new Error('Catálogo vazio');
      const result = await bridge.analyze({ serviceId: catalog.services[0].id,
        prompt: 'sem foto depois', history: [] });
      if (result.decision !== 'Reprovado') throw new Error('Regressão de decisão');
      return { services: catalog.services.length, ruleVersion: catalog.ruleStoreVersion,
        decision: result.decision, bridge: true, nodeDisabled: true };
    })()`);
    await mkdir('desktop-release', { recursive: true });
    await writeFile('desktop-release/desktop-smoke.json', JSON.stringify(result, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 700));
    await writeFile('desktop-release/desktop-preview.png', (await window.webContents.capturePage()).toPNG());
    console.log('Desktop validado: renderer isolado, ponte IPC, catálogo e análise local.');
    app.exit(0);
  } catch (error) {
    // Só usa entradas sintéticas deste teste; nenhum conteúdo de analista é executado aqui.
    console.error('Falha no teste do desktop:', error instanceof Error ? error.message : 'erro desconhecido');
    app.exit(1);
  }
}

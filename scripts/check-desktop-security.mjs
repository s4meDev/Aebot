import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { inspectRuntimeSecurity, requireSignedRuntime, runtimeDirectoryName } from './runtime-security.mjs';

try {
  const root = path.join(import.meta.dirname, '..', 'desktop-resources');
  const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
  const report = inspectRuntimeSecurity(path.join(root, runtimeDirectoryName(lock)));
  console.log(`Smart App Control: ${report.smartAppControl}. Consulta aos eventos: ${report.eventsReadable ? 'disponível' : 'indisponível'}.`);
  for (const file of report.signatures) console.log(`${file.file}: ${file.status}`);
  for (const event of report.recentBlocks) console.log(`Bloqueio registrado: ${event.file}, evento ${event.eventId}, ${event.at}.`);
  console.log('Eventos são históricos: não provam bloqueio atual se arquivo ou política mudou. Assinatura válida não garante aceite de toda política corporativa.');
  if (process.argv.includes('--require-signed-runtime')) requireSignedRuntime(report);
  else if (!report.runtimeSignaturesValid) {
    console.log('Pendência de distribuição: o runtime ainda não tem todas as assinaturas válidas. Não desative a segurança do Windows.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Diagnóstico não concluído.');
  process.exitCode = 1;
}

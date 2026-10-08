import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { totalmem } from 'node:os';
import assetsLock from '../desktop-resources/assets-lock.json';
import { ModelRuntime } from './ModelRuntime';
import { verifyModelIntegrity } from './ModelIntegrity';
import { atomicJson } from './LocalData';
import { ruleEngine } from '../src/services/RuleEngine';
import { createLocalInterpretation } from '../src/ai/LocalInterpretation';
import { PublicCatalogCache, catalogInstructionHash, catalogProfileHash, parsePublicCatalogIndex, type PublicCatalogEntry } from './PublicCatalogCache';
import { validatePublicPrefill, validatePublicSnapshot } from './PublicCatalogPreparation';

// Este programa isolado recebe apenas IDs públicos. Não aceita relato, histórico
// ou arquivo de conversa. O aplicativo do analista nunca chama action=save.
const ids = process.argv.filter(arg => arg.startsWith('--service=')).map(arg => arg.slice('--service='.length));
if (!ids.length) throw new Error('Informe ao menos um --service=ID do catálogo.');
const services = ids.map(id => {
  const service = ruleEngine.getServices().find(item => item.id === id);
  if (!service || service.analysisStatus === 'rules_pending') throw new Error('Serviço inexistente ou pendente.');
  return service;
});
const directory = path.resolve('desktop-resources/catalog-cache');
await mkdir(directory, { recursive: true });
const instructions = [...new Set(services.map(service => {
  const rules = ruleEngine.getRulesForService(service.id);
  return createLocalInterpretation('', service, rules, [], {}, rules, 'indexed').systemInstruction! + '\n/no_think';
}))];
const entries: PublicCatalogEntry[] = [];
// Prepara os dois perfis reais. Não presume que o estado de 8 GB seja compatível
// com a janela de 16 GB: cada arquivo tem identidade própria.
for (const memory of [8, 16]) {
  const runtime = new ModelRuntime(path.resolve('desktop-resources'), 512, memory * 1024 ** 3,
    assetsLock.model, directory);
  try {
    await runtime.start();
    const connection = runtime.connection();
    if (!connection) throw new Error(runtime.message);
    const prepared = new PublicCatalogCache(directory, runtime.connection, runtime.resourceProfile);
    const post = async (endpoint: string, body: unknown) => {
      const response = await fetch(connection.url + endpoint, { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(300_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify(body) });
      if (!response.ok) throw new Error('Preparação recusada pelo runtime.');
      return await response.json() as Record<string, unknown>;
    };
    for (const instruction of instructions) {
      const started = Date.now();
      // Só reutiliza uma preparação pública íntegra. Este processo continua
      // isolado e não recebe relatos, mesmo quando a preparação anterior existe.
      await prepared.restore(instruction);
      const instructionSha256 = catalogInstructionHash(instruction);
      const profileSha256 = catalogProfileHash(runtime.resourceProfile);
      const previous = entries.find(entry => entry.instructionSha256 === instructionSha256);
      if (previous) {
        // Só testa uma preparação PÚBLICA feita nesta própria execução. O
        // runtime do outro perfil precisa aceitar a restauração; nunca copiamos
        // metadados de compatibilidade presumindo que uma janela equivale à outra.
        await verifyModelIntegrity(path.join(directory, previous.filename), previous);
        const restored = await post('/slots/0?action=restore', { filename: previous.filename });
        if (restored.n_restored !== previous.tokens) throw new Error('Perfil não restaurou o catálogo público.');
      }
      // Nome novo por preparação: uma falha não corrompe arquivos do índice anterior.
      const filename = createHash('sha256').update(instructionSha256 + profileSha256 + randomBytes(16).toString('hex')).digest('hex') + '.bin';
      const template = await post('/apply-template', { messages: [{ role: 'system', content: instruction },
        { role: 'user', content: '' }], chat_template_kwargs: { enable_thinking: false } });
      if (typeof template.prompt !== 'string') throw new Error('Template inválido.');
      const tokenized = await post('/tokenize', { content: template.prompt, add_special: false, parse_special: true });
      if (!Array.isArray(tokenized.tokens) || !tokenized.tokens.length ||
          !tokenized.tokens.every(item => Number.isSafeInteger(item) && item >= 0)) throw new Error('Tokens inválidos.');
      if (tokenized.tokens.length + 512 >= runtime.resourceProfile.contextTokens) throw new Error('Catálogo não cabe no perfil sem truncamento.');
      // A gramática vazia impede texto mesmo no runtime que amostra um token
      // de encerramento com n_predict=0. Esse token não pode entrar no arquivo.
      const evaluated = await post('/completion', { prompt: tokenized.tokens, n_predict: 0, grammar: 'root ::= ""',
        return_tokens: true, cache_prompt: true, id_slot: 0 });
      validatePublicPrefill(evaluated, tokenized.tokens.length);
      const saved = await post('/slots/0?action=save', { filename });
      validatePublicSnapshot(saved, tokenized.tokens.length);
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(path.join(directory, filename))) hash.update(chunk);
      const sha256 = hash.digest('hex');
      const identical = entries.find(entry => entry.sha256 === sha256 && entry.size === Number(saved.n_written));
      entries.push({ instructionSha256, profileSha256, filename: identical?.filename ?? filename, sha256,
        size: Number(saved.n_written), tokens: Number(saved.n_saved) });
      console.log(`Catálogo público ${instructionSha256.slice(0, 8)} · perfil ${memory} GB · ${saved.n_saved} tokens · ${Date.now() - started} ms`);
    }
  } finally { runtime.stop(); }
}
// O índice só é publicado depois da preparação completa. Arquivos de versões
// anteriores permanecem, mas só os listados neste índice serão empacotados.
await atomicJson(path.join(directory, 'index.json'), parsePublicCatalogIndex({ format: 1, modelSha256: assetsLock.model.sha256,
  runtimeVersion: assetsLock.runtime.version, entries }));
console.log(`Preparação concluída para ${entries.length} catálogos/perfis. Memória da máquina: ${totalmem()} bytes.`);

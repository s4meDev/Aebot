import { readFile, mkdir, writeFile } from 'node:fs/promises';
const option = (key) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const owner = option('owner'), changes = option('changes');
if (!owner || owner.trim().length < 3 || !changes || changes.trim().length < 10) {
  throw new Error('Informe --owner="Responsável" e --changes="Descrição da revisão aprovada".');
}
const store = JSON.parse(await readFile('src/data/rulesStore.json', 'utf8'));
await mkdir('desktop-release', { recursive: true });
await writeFile('desktop-release/rules-release.json', JSON.stringify({ format: 'aebot-rule-release-v1',
  owner, effectiveAt: new Date().toISOString(), changes, store }, null, 2));
console.log(`Pacote ${store.version} criado. Só será aceito por instalações com versão de regras anterior.`);

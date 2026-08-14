import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const storePath = path.join(projectRoot, 'src', 'data', 'rulesStore.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const compactValues = new Map();
let compactIndex = 0;

function compactShortLists(_key, value) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return value;
  const serialized = JSON.stringify(value);
  if (serialized.length > 160) return value;

  const marker = `__AEBOT_COMPACT_LIST_${compactIndex}__`;
  compactIndex += 1;
  compactValues.set(marker, serialized);
  return marker;
}

let output = JSON.stringify(store, compactShortLists, 2);
for (const [marker, serialized] of compactValues) {
  output = output.replace(JSON.stringify(marker), serialized);
}

fs.writeFileSync(storePath, `${output}\n`, 'utf8');
console.log(`Base formatada: ${compactValues.size} lista(s) curta(s) compactadas.`);

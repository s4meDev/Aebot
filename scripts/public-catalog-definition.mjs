import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/** Fixa a identidade do índice público no bundle. Ausência não autoriza cache externo. */
export async function publicCatalogDefinition(root) {
  const file = path.join(root, 'desktop-resources/catalog-cache/index.json');
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 ** 2) throw new Error('Índice público inválido.');
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    return { __AEBOT_PUBLIC_CATALOG_INDEX_SHA256__: JSON.stringify(hash) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { __AEBOT_PUBLIC_CATALOG_INDEX_SHA256__: 'null' };
  }
}

import path from 'node:path';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import assetsLock from '../desktop-resources/assets-lock.json';
import { verifyModelIntegrity } from './ModelIntegrity';
import type { runtimeResourceProfile } from './ModelRuntime';

// O build fixa este hash dentro do código empacotado. Editar o índice externo
// junto do arquivo binário não pode fazer um cache adulterado parecer íntegro.
declare const __AEBOT_PUBLIC_CATALOG_INDEX_SHA256__: string | null;

export interface PublicCatalogEntry {
  instructionSha256: string;
  profileSha256: string;
  filename: string;
  sha256: string;
  size: number;
  tokens: number;
}
export interface PublicCatalogIndex {
  format: 1;
  modelSha256: string;
  runtimeVersion: string;
  entries: PublicCatalogEntry[];
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const catalogInstructionHash = (instruction: string) => digest(instruction);
export const catalogProfileHash = (profile: ReturnType<typeof runtimeResourceProfile>) => digest(JSON.stringify(profile));

/** O arquivo é um recurso do pacote, não uma sessão ou um histórico de usuário. */
export function parsePublicCatalogIndex(value: unknown): PublicCatalogIndex {
  const hash = (item: unknown): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Índice inválido.');
  const index = value as PublicCatalogIndex;
  if (Object.keys(index).some(key => !['format', 'modelSha256', 'runtimeVersion', 'entries'].includes(key)) ||
      index.format !== 1 || !hash(index.modelSha256) || typeof index.runtimeVersion !== 'string' ||
      !Array.isArray(index.entries) || index.entries.length > 32) throw new Error('Índice inválido.');
  const identities = new Set<string>();
  let bytes = 0;
  for (const entry of index.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !['instructionSha256', 'profileSha256', 'filename', 'sha256', 'size', 'tokens'].includes(key)) ||
        !hash(entry.instructionSha256) || !hash(entry.profileSha256) || !hash(entry.sha256) ||
        !/^[a-f0-9]{64}\.bin$/.test(entry.filename) || !Number.isSafeInteger(entry.size) ||
        entry.size < 1 || entry.size > 512 * 1024 ** 2 || !Number.isSafeInteger(entry.tokens) ||
        entry.tokens < 1 || entry.tokens > 16384) throw new Error('Entrada inválida.');
    const identity = entry.instructionSha256 + entry.profileSha256;
    if (identities.has(identity)) throw new Error('Entrada duplicada.');
    identities.add(identity); bytes += entry.size;
  }
  if (bytes > 2 * 1024 ** 3) throw new Error('Catálogo preparado grande demais.');
  return index;
}

/** Só RESTAURA catálogos públicos previamente preparados. Não oferece operação de salvar. */
export class PublicCatalogCache {
  private index?: PublicCatalogIndex;
  private loaded = false;
  private lastConnection?: string;
  private activeInstruction?: string;
  private unsafeState = false;
  private attempted = new Set<string>();
  constructor(private readonly directory: string,
    private readonly connection: () => { url: string; token: string } | null,
    private readonly profile: ReturnType<typeof runtimeResourceProfile>,
    private readonly modelSha256 = assetsLock.model.sha256,
    private readonly indexSha256: string | null = typeof __AEBOT_PUBLIC_CATALOG_INDEX_SHA256__ === 'undefined'
      ? null : __AEBOT_PUBLIC_CATALOG_INDEX_SHA256__) {}

  async restore(instruction: string): Promise<boolean> {
    const connection = this.connection();
    if (!connection || !this.indexSha256) return false;
    const url = new URL(connection.url);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) return false;
    // Um reinício perde o cache em RAM. A credencial só é comparada em memória.
    const connectionIdentity = connection.url + connection.token;
    if (this.lastConnection !== connectionIdentity) {
      this.lastConnection = connectionIdentity; this.activeInstruction = undefined; this.attempted.clear();
      this.unsafeState = false;
    }
    if (this.unsafeState) throw new Error('Reinicie a IA para descartar um estado de cache não confirmado.');
    const instructionHash = catalogInstructionHash(instruction);
    if (this.activeInstruction === instructionHash || this.attempted.has(instructionHash)) return false;
    this.activeInstruction = instructionHash;
    let restoreAttempted = false;
    try {
      if (!this.loaded) {
        this.loaded = true;
        const directory = await lstat(this.directory);
        if (!directory.isDirectory() || directory.isSymbolicLink()) return false;
        const file = path.join(this.directory, 'index.json');
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 ** 2) return false;
        const contents = await readFile(file, 'utf8');
        if (digest(contents) !== this.indexSha256) return false;
        this.index = parsePublicCatalogIndex(JSON.parse(contents));
      }
      if (this.index?.modelSha256 !== this.modelSha256 || this.index.runtimeVersion !== assetsLock.runtime.version) return false;
      const entry = this.index.entries.find(item => item.instructionSha256 === instructionHash &&
        item.profileSha256 === catalogProfileHash(this.profile));
      if (!entry) return false; // Base/modelo/perfil diferente: a leitura normal continua, sem cache antigo.
      const file = path.join(this.directory, entry.filename);
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) return false;
      await verifyModelIntegrity(file, entry);
      restoreAttempted = true;
      const response = await fetch(new URL('/slots/0?action=restore', url), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify({ filename: entry.filename }),
      });
      if (!response.ok || (await response.json() as { n_restored?: unknown }).n_restored !== entry.tokens) {
        throw new Error('Restauração recusada.');
      }
      return true;
    } catch {
      // Falha de cache não vira conclusão. A chamada seguinte reprocessa o prompt
      // real; não salva o slot atual nem registra texto ou erros do runtime.
      this.attempted.add(instructionHash);
      if (restoreAttempted) {
        // Uma restauração recusada pode ter tocado a RAM do slot. Só continua
        // após apagar esse estado; se não confirmar, bloqueia até reiniciar.
        this.unsafeState = true;
        try {
          const erased = await fetch(new URL('/slots/0?action=erase', url), {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${connection.token}` },
          });
          const body = erased.ok ? await erased.json() as { n_erased?: unknown } : undefined;
          if (body && Number.isSafeInteger(body.n_erased) && Number(body.n_erased) >= 0) this.unsafeState = false;
        } catch { /* Não tenta contornar autenticação ou inventar um estado íntegro. */ }
        if (this.unsafeState) throw new Error('Não foi possível descartar o cache local com segurança. Reinicie a IA.');
      }
      return false;
    }
  }
}

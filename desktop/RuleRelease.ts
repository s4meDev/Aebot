import { parseRuleStore } from '../src/services/RuleStoreValidator';
import type { RuleStoreSchema } from '../src/types';

export interface RuleRelease {
  format: 'aebot-rule-release-v1';
  owner: string;
  effectiveAt: string;
  changes: string;
  store: RuleStoreSchema;
}

export function parseRuleRelease(value: unknown, currentVersion?: string, now = Date.now()): RuleRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pacote de regras inválido.');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !['format', 'owner', 'effectiveAt', 'changes', 'store'].includes(key)) ||
    item.format !== 'aebot-rule-release-v1') throw new Error('Formato de pacote não suportado.');
  if (typeof item.owner !== 'string' || item.owner.trim().length < 3 || item.owner.length > 160 ||
    typeof item.changes !== 'string' || item.changes.trim().length < 10 || item.changes.length > 4000) {
    throw new Error('Informe responsável e descrição da alteração.');
  }
  if (typeof item.effectiveAt !== 'string' || !Number.isFinite(Date.parse(item.effectiveAt)) ||
    Date.parse(item.effectiveAt) > now) throw new Error('A vigência deve ser uma data válida já iniciada.');
  const store = parseRuleStore(item.store);
  if (!/^\d+\.\d+\.\d+$/.test(store.version)) throw new Error('Use versão numérica major.minor.patch.');
  if (currentVersion) {
    const next = store.version.split('.').map(Number), current = currentVersion.split('.').map(Number);
    const index = next.findIndex((part, i) => part !== current[i]);
    if (index < 0 || next[index] < current[index]) throw new Error('O pacote precisa ter versão maior que a base instalada.');
  }
  return { format: 'aebot-rule-release-v1', owner: item.owner.trim(), effectiveAt: item.effectiveAt,
    changes: item.changes.trim(), store };
}

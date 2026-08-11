import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const storePath = path.join(projectRoot, 'src', 'data', 'rulesStore.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const officialDecisions = new Set(['Conforme', 'Não Conforme', 'Reprovado']);

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const serviceIds = new Set(store.services.map((service) => service.id));
const ids = new Set();
const structuralErrors = [];
const warnings = [];
const expressionOwners = new Map();

for (const service of store.services) {
  for (const [relation, targetIds] of Object.entries(service.parameterization ?? {})) {
    if (new Set(targetIds).size !== targetIds.length) {
      structuralErrors.push(`${service.id}.${relation}: serviço duplicado`);
    }
    for (const targetId of targetIds) {
      if (!serviceIds.has(targetId)) {
        structuralErrors.push(`${service.id}.${relation}: serviço inexistente ${targetId}`);
      }
      if (targetId === service.id) {
        structuralErrors.push(`${service.id}.${relation}: autorreferência não permitida`);
      }
    }
  }
}

for (const rule of store.rules) {
  if (ids.has(rule.id)) structuralErrors.push(`ID duplicado: ${rule.id}`);
  ids.add(rule.id);
  if (!serviceIds.has(rule.serviceId)) {
    structuralErrors.push(`${rule.id}: serviço inexistente ${rule.serviceId}`);
  }
  for (const applicableServiceId of rule.applicableServiceIds ?? []) {
    if (!serviceIds.has(applicableServiceId)) {
      structuralErrors.push(`${rule.id}: serviço aplicável inexistente ${applicableServiceId}`);
    }
    if (applicableServiceId === rule.serviceId) {
      structuralErrors.push(`${rule.id}: serviço principal repetido em applicableServiceIds`);
    }
  }
  if (new Set(rule.applicableServiceIds ?? []).size !== (rule.applicableServiceIds ?? []).length) {
    structuralErrors.push(`${rule.id}: serviço aplicável duplicado`);
  }
  if (rule.severity !== undefined && !officialDecisions.has(rule.severity)) {
    structuralErrors.push(`${rule.id}: conclusão não oficial ${rule.severity}`);
  }
  if (!rule.examples?.length) warnings.push(`${rule.id}: regra sem exemplo cadastrado`);

  const expressions = [
    ...(rule.conditionKeywords ?? []),
    ...(rule.equivalentExpressions ?? []),
    ...(rule.matchPolicy?.allOf ?? []),
    ...(rule.matchPolicy?.minimumGroups?.groups?.flatMap((group) => group.expressions) ?? []),
  ];
  for (const expression of expressions) {
    const normalized = normalize(expression);
    if (!normalized) continue;
    for (const serviceId of [rule.serviceId, ...(rule.applicableServiceIds ?? [])]) {
      const key = `${serviceId}:${normalized}`;
      const owners = expressionOwners.get(key) ?? [];
      owners.push({ id: rule.id, severity: rule.severity ?? null });
      expressionOwners.set(key, owners);
    }
  }
}

for (const [key, owners] of expressionOwners) {
  const decisions = new Set(owners.map((owner) => owner.severity).filter(Boolean));
  if (decisions.size > 1) {
    warnings.push(
      `Expressão idêntica com conclusões diferentes (${key.split(':').slice(1).join(':')}): ${owners.map((owner) => owner.id).join(', ')}`
    );
  }
}

const decisionRules = store.rules.filter((rule) => rule.severity);
const guidanceRules = store.rules.filter((rule) => !rule.severity);
const pendingServices = store.services.filter((service) => service.analysisStatus === 'rules_pending');
const namesToConfirm = store.services.filter(
  (service) => service.catalogNameStatus === 'needs_confirmation'
);
console.log(`Base ${store.version}: ${store.services.length} serviço(s), ${store.rules.length} regra(s).`);
console.log(`Classificatórias: ${decisionRules.length}; orientativas: ${guidanceRules.length}.`);
console.log(`Serviços com regras pendentes: ${pendingServices.length}; nomes a confirmar: ${namesToConfirm.length}.`);
if (warnings.length) {
  console.log(`Avisos de governança (${warnings.length}):`);
  for (const warning of warnings) console.log(`- ${warning}`);
} else {
  console.log('Nenhum aviso de governança.');
}
if (structuralErrors.length) {
  for (const error of structuralErrors) console.error(`ERRO: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Integridade estrutural básica aprovada.');
}

if (process.argv.includes('--strict') && warnings.length) process.exitCode = 2;

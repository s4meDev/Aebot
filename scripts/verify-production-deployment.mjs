import fs from 'node:fs';
import path from 'node:path';

// Este teste grava o ID do feedback técnico para ele ser removido depois da validação.
const privateDirectory = path.resolve(process.cwd(), '.aebot-private');
const appVersion = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8')
).version;
const rawUrl = process.argv[2]?.trim();
if (!rawUrl) throw new Error('Informe a origem HTTPS publicada como primeiro argumento.');
const baseUrl = new URL(rawUrl);
if (baseUrl.protocol !== 'https:' || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
  throw new Error('A URL de produção deve conter somente uma origem HTTPS.');
}

function latestFile(prefix, suffix) {
  const match = fs.readdirSync(privateDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => ({ name, modifiedAt: fs.statSync(path.join(privateDirectory, name)).mtimeMs }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
  if (!match) throw new Error(`Arquivo ${prefix}*${suffix} não encontrado.`);
  return path.join(privateDirectory, match.name);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(pathname, init = {}, expectedStatus = 200) {
  const response = await fetch(new URL(pathname, baseUrl), init);
  assert(
    response.status === expectedStatus,
    `${pathname} respondeu HTTP ${response.status}; esperado ${expectedStatus}.`
  );
  return response;
}

const tokens = JSON.parse(fs.readFileSync(latestFile('analyst-tokens-', '.json'), 'utf8'));
const [analystId, analystToken] = Object.entries(tokens)[0] ?? [];
assert(typeof analystId === 'string' && typeof analystToken === 'string', 'Token de analista ausente.');
const adminToken = fs.readFileSync(latestFile('admin-token-', '.txt'), 'utf8').trim();
const extensionId = fs.readFileSync(path.join(privateDirectory, 'extension-id.txt'), 'utf8').trim();
assert(/^[a-p]{32}$/.test(extensionId), 'ID da extensão inválido.');
const extensionOrigin = `chrome-extension://${extensionId}`;
const analystHeaders = { Authorization: `Bearer ${analystToken}`, Origin: extensionOrigin };

const health = await (await request('/health')).json();
assert(health.status === 'ok', 'Health check incompatível.');
assert(health.accessConfigured === true, 'Tokens dos analistas não estão ativos.');
assert(health.feedbackConfigured === true, 'D1 de feedback não está ativo.');
assert(health.adminConfigured === true, 'Acesso administrativo não está ativo.');

const catalogResponse = await request('/v1/services', { headers: analystHeaders });
assert(catalogResponse.headers.get('access-control-allow-origin') === extensionOrigin, 'CORS incorreto.');
const catalog = await catalogResponse.json();
const serviceId = catalog.services?.[0]?.id;
assert(typeof serviceId === 'string' && serviceId, 'Catálogo sem serviço utilizável.');

const analysis = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceId, prompt: 'sem foto depois', history: [] }),
})).json();
assert(analysis.result?.decision === 'Reprovado', 'Decisão determinística de verificação divergiu.');

const missingParameterization = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    prompt: 'Faltou adicional executado.',
    history: [],
  }),
})).json();
assert(
  missingParameterization.result?.decision === 'Não Conforme',
  'Regra geral de parametrização ausente divergiu.'
);

const impossibleExchange = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    prompt: 'Não há possibilidade de troca do serviço.',
    history: [],
  }),
})).json();
assert(
  impossibleExchange.result?.decision === 'Reprovado',
  'Regra de impossibilidade de troca divergiu.'
);

const groundedAdvisory = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    prompt: 'A foto foi feita na vertical.',
    history: [],
  }),
})).json();
assert(
  groundedAdvisory.result?.decision === null &&
    groundedAdvisory.result?.evaluation?.outcome === 'advisory',
  'Orientação fundamentada foi promovida indevidamente a decisão.'
);

const unsupportedPavingBranch = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    prompt: 'Sem foto da vala feita na OS, então tiro o desdobro de repavimentação?',
    history: [],
  }),
})).json();
assert(
  unsupportedPavingBranch.result?.decision === null &&
    unsupportedPavingBranch.result?.evaluation?.outcome === 'advisory' &&
    unsupportedPavingBranch.result?.evaluation?.primaryRule?.id === 'RULE-PARAM-ESCAVACAO-01' &&
    unsupportedPavingBranch.result?.content?.includes('retire o desdobro'),
  'Orientação para retirar desdobro sem evidência de vala divergiu.'
);

const contextualAnalysis = await (await request('/v1/analyze', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    prompt: 'Mas não tem foto antes também.',
    history: [
      {
        id: 'deployment-context-user',
        role: 'user',
        content: 'Não mostrou o aperto da virola.',
        timestamp: '09:00',
      },
      {
        id: 'deployment-context-assistant',
        role: 'assistant',
        content: 'Não Conforme.',
        timestamp: '09:01',
      },
    ],
  }),
})).json();
assert(
  contextualAnalysis.result?.decision === 'Reprovado',
  `A composição conversacional divergiu: decisão=${String(contextualAnalysis.result?.decision)}, ` +
    `regra=${String(contextualAnalysis.result?.evaluation?.primaryRule?.id)}, ` +
    `matches=${String(contextualAnalysis.result?.evaluation?.matchedRules?.map((rule) => rule.id).join(','))}.`
);

await request('/v1/services', {
  headers: { Authorization: 'Bearer token-invalido', Origin: extensionOrigin },
}, 401);
await request('/v1/services', {
  headers: { Authorization: `Bearer ${analystToken}`, Origin: 'https://origem-invalida.example' },
}, 403);

const feedback = await (await request('/v1/feedback', {
  method: 'POST',
  headers: { ...analystHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId,
    category: 'outro',
    message: 'Verificação automatizada de implantação do canal de feedback.',
    appVersion,
  }),
}, 201)).json();
assert(typeof feedback.feedbackId === 'string' && feedback.feedbackId, 'Feedback sem identificador.');
fs.writeFileSync(
  path.join(privateDirectory, 'deployment-verification-feedback-id.txt'),
  `${feedback.feedbackId}\n`,
  { encoding: 'utf8', mode: 0o600 }
);

const adminFeedback = await (await request('/v1/admin/feedback?limit=10&offset=0', {
  headers: { Authorization: `Bearer ${adminToken}` },
})).json();
assert(
  adminFeedback.feedback?.some((item) => item.id === feedback.feedbackId),
  'O painel administrativo não recuperou o feedback salvo.'
);
const adminPage = await request('/admin');
assert((await adminPage.text()).includes('Feedback dos analistas'), 'Página administrativa incompatível.');

console.log('Produção validada: saúde, CORS, autenticação, catálogo, decisão, feedback e painel administrativo.');
console.log(`Identidade operacional usada no teste: ${analystId}.`);
console.log('Nenhum token ou conteúdo de conversa foi exibido.');

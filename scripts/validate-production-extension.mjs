import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');

function fail(message) {
  throw new Error(`Validação do pacote de produção falhou: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function normalizeOrigin(rawValue) {
  if (!rawValue?.trim()) fail('AEBOT_PRODUCTION_API_URL não foi informada');
  try {
    const url = new URL(rawValue.trim());
    if (
      url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw new Error();
    }
    return url.origin;
  } catch {
    fail('AEBOT_PRODUCTION_API_URL deve ser uma origem HTTPS sem caminho ou credenciais');
  }
}

const apiOrigin = normalizeOrigin(process.env.AEBOT_PRODUCTION_API_URL);
const manifestPath = path.join(distDirectory, 'manifest.json');
const packagePath = path.join(projectRoot, 'package.json');
for (const requiredPath of [manifestPath, packagePath, path.join(distDirectory, 'index.html'), path.join(distDirectory, 'background.js')]) {
  if (!fs.existsSync(requiredPath) || !fs.statSync(requiredPath).isFile()) {
    fail(`arquivo obrigatório ausente: ${path.relative(projectRoot, requiredPath)}`);
  }
}

const manifest = readJson(manifestPath);
const packageData = readJson(packagePath);
if (manifest.manifest_version !== 3) fail('manifest_version deve ser 3');
if (manifest.version !== packageData.version) fail('versões do manifest e package.json divergem');
if (process.env.AEBOT_REQUIRE_STABLE_EXTENSION_ID === 'true') {
  const expectedKey = process.env.AEBOT_EXTENSION_PUBLIC_KEY?.replace(/\s+/g, '');
  if (!expectedKey || manifest.key !== expectedKey) {
    fail('chave pública ausente; o ID não seria estável entre as 40 instalações');
  }
}
if (manifest.permissions?.length !== 1 || manifest.permissions[0] !== 'sidePanel') {
  fail('permissões de API inesperadas');
}
const expectedPermission = `${apiOrigin}/*`;
if (manifest.host_permissions?.length !== 1 || manifest.host_permissions[0] !== expectedPermission) {
  fail(`host_permissions deve conter apenas ${expectedPermission}`);
}

const extensionPolicy = manifest.content_security_policy?.extension_pages ?? '';
const expectedPolicy = `script-src 'self'; object-src 'self'; connect-src ${apiOrigin}`;
if (extensionPolicy !== expectedPolicy) fail('CSP não está restrita à API de produção');

const forbiddenPatterns = [
  { name: 'chave Gemini', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: 'chave exposta por Vite', pattern: /VITE_[A-Z0-9_]*KEY/ },
  { name: 'eval inseguro', pattern: /\beval\s*\(/ },
];
for (const filePath of listFiles(distDirectory)) {
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(contents)) {
      fail(`${forbidden.name} encontrada em ${path.relative(distDirectory, filePath)}`);
    }
  }
}

console.log(`Pacote MV3 ${manifest.version} de produção validado para ${apiOrigin}.`);

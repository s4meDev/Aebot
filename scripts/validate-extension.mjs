import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');

function fail(message) {
  throw new Error(`Validação da extensão falhou: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function productionOriginFromPermission(permission) {
  if (typeof permission !== 'string' || !permission.endsWith('/*')) return null;
  try {
    const url = new URL(permission.slice(0, -2));
    if (
      url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function requireFile(relativePath) {
  const filePath = path.join(distDirectory, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`arquivo obrigatório ausente em dist: ${relativePath}`);
  }
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const manifestPath = path.join(distDirectory, 'manifest.json');
const packagePath = path.join(projectRoot, 'package.json');
requireFile('manifest.json');

const manifest = readJson(manifestPath);
const packageData = readJson(packagePath);

if (manifest.manifest_version !== 3) fail('manifest_version deve ser 3');
if (manifest.version !== packageData.version) fail('versões do manifest e package.json divergem');
if (manifest.side_panel?.default_path !== 'index.html') fail('side panel não aponta para index.html');
if (manifest.background?.service_worker !== 'background.js') fail('service worker divergente');

const apiPermissions = manifest.permissions ?? [];
if (apiPermissions.length !== 1 || apiPermissions[0] !== 'sidePanel') {
  fail('permissões de API inesperadas');
}

const hostPermissions = manifest.host_permissions ?? [];
const expectedHostPermissions = [
  'https://generativelanguage.googleapis.com/*',
  'http://127.0.0.1/*',
  'http://localhost/*',
];
const isDevelopmentProfile = (
  hostPermissions.length !== expectedHostPermissions.length ||
  expectedHostPermissions.some((permission) => !hostPermissions.includes(permission))
)
  ? false
  : true;
const productionOrigin = hostPermissions.length === 1
  ? productionOriginFromPermission(hostPermissions[0])
  : null;
const isProductionProfile = Boolean(productionOrigin) &&
  hostPermissions[0] !== 'https://generativelanguage.googleapis.com/*' &&
  typeof manifest.key === 'string' &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(manifest.key);
if (!isDevelopmentProfile && !isProductionProfile) {
  fail('host_permissions não corresponde ao perfil local nem ao pacote empresarial');
}

const extensionPolicy = manifest.content_security_policy?.extension_pages ?? '';
if (isDevelopmentProfile && !extensionPolicy.includes('http://127.0.0.1:*')) {
  fail('CSP não permite backend local no perfil de desenvolvimento');
}
if (isProductionProfile) {
  const expectedPolicy = `script-src 'self'; object-src 'self'; connect-src ${productionOrigin}`;
  if (extensionPolicy !== expectedPolicy) fail('CSP do pacote empresarial não está restrita à API');
}
if (!extensionPolicy.includes("script-src 'self'")) fail('CSP não restringe scripts locais');
if (extensionPolicy.includes('unsafe-eval')) fail('CSP contém unsafe-eval');

requireFile(manifest.side_panel.default_path);
requireFile(manifest.background.service_worker);

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

console.log(`Extensão MV3 ${manifest.version} validada com segurança em dist.`);

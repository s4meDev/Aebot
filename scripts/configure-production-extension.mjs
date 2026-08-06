import fs from 'node:fs';
import path from 'node:path';

// Restringe o build já gerado à API oficial e aplica a identidade fixa da extensão.
const projectRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(projectRoot, 'dist', 'manifest.json');

function productionOrigin(rawValue) {
  if (!rawValue?.trim()) {
    throw new Error('Defina AEBOT_PRODUCTION_API_URL com a origem HTTPS da API.');
  }
  const url = new URL(rawValue.trim());
  if (
    url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error(
      'AEBOT_PRODUCTION_API_URL deve conter somente uma origem HTTPS, como https://aebot.exemplo.com.'
    );
  }
  return url.origin;
}

function extensionPublicKey(rawValue) {
  const candidate = rawValue?.replace(/\s+/g, '') ?? '';
  if (!candidate) return '';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(candidate)) {
    throw new Error('AEBOT_EXTENSION_PUBLIC_KEY deve ser uma chave pública DER em Base64.');
  }
  const decoded = Buffer.from(candidate, 'base64');
  if (
    decoded.length < 128 ||
    decoded.toString('base64').replace(/=+$/, '') !== candidate.replace(/=+$/, '')
  ) {
    throw new Error('AEBOT_EXTENSION_PUBLIC_KEY não possui um formato Base64 válido.');
  }
  return candidate;
}

if (!fs.existsSync(manifestPath)) {
  throw new Error('Execute o build antes de configurar o pacote de produção.');
}

const apiOrigin = productionOrigin(process.env.AEBOT_PRODUCTION_API_URL);
const publicKey = extensionPublicKey(process.env.AEBOT_EXTENSION_PUBLIC_KEY);
if (process.env.AEBOT_REQUIRE_STABLE_EXTENSION_ID === 'true' && !publicKey) {
  throw new Error(
    'AEBOT_EXTENSION_PUBLIC_KEY é obrigatória para distribuir o mesmo ID da extensão em 40 máquinas.'
  );
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.host_permissions = [`${apiOrigin}/*`];
manifest.content_security_policy = {
  extension_pages: `script-src 'self'; object-src 'self'; connect-src ${apiOrigin}`,
};
if (publicKey) manifest.key = publicKey;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Pacote de produção limitado a ${apiOrigin}.`);
console.log(publicKey
  ? 'Identidade estável da extensão incluída no pacote.'
  : 'Aviso: pacote sem chave pública; use AEBOT_REQUIRE_STABLE_EXTENSION_ID=true na distribuição empresarial.');

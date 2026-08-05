const rawUrl = process.env.AEBOT_URL?.trim() || 'http://127.0.0.1:8787';
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3_000);

try {
  const url = new URL('/health', rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`);
  const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const health = await response.json();
  if (
    health?.status !== 'ok' ||
    health?.service !== 'aebot-api' ||
    typeof health?.geminiConfigured !== 'boolean'
  ) {
    throw new Error('resposta incompatível');
  }
  console.log([
    `Backend: ativo em ${rawUrl}`,
    `Base: ${health.ruleStoreVersion ?? 'versão não informada'}`,
    `Gemini central: ${health.geminiConfigured ? 'configurado' : 'não configurado'}`,
  ].join('\n'));
} catch (error) {
  const reason = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Backend indisponível em ${rawUrl}: ${reason}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
}

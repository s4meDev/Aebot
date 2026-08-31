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
    typeof health?.geminiConfigured !== 'boolean' ||
    (health?.aiConfigured !== undefined && typeof health.aiConfigured !== 'boolean')
  ) {
    throw new Error('resposta incompatível');
  }
  console.log([
    `Backend: ativo em ${rawUrl}`,
    `Base: ${health.ruleStoreVersion ?? 'versão não informada'}`,
    `IA central: ${(health.aiConfigured ?? health.geminiConfigured)
      ? health.aiProvider === 'workers-ai' ? 'Workers AI' : 'Gemini'
      : 'não configurada'}`,
  ].join('\n'));

  const checkToken = process.env.AEBOT_CHECK_TOKEN?.trim()
    || process.env.AEBOT_API_TOKEN?.trim()
    || '';
  if (checkToken) {
    const statusUrl = new URL('/v1/status', rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`);
    const statusResponse = await fetch(statusUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${checkToken}` },
    });
    if (!statusResponse.ok) throw new Error(`diagnóstico autenticado respondeu HTTP ${statusResponse.status}`);
    const status = await statusResponse.json();
    if (status?.status !== 'ok' || typeof status?.uptimeSeconds !== 'number') {
      throw new Error('diagnóstico autenticado incompatível');
    }
    console.log([
      `Serviços/regras: ${status.serviceCount ?? '?'} / ${status.ruleCount ?? '?'}`,
      `Cache semântico: ${status.aiMetrics?.semanticCacheEntries ?? 0} entrada(s)`,
      `Chamadas ao modelo desde o início: ${status.aiMetrics?.modelRequests ?? 0}`,
    ].join('\n'));
  } else {
    console.log('Diagnóstico autenticado não executado: defina AEBOT_CHECK_TOKEN ou AEBOT_API_TOKEN.');
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Backend indisponível em ${rawUrl}: ${reason}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
}

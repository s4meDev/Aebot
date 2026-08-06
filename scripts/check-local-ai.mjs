import os from 'node:os';

const rawUrl = process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3_000);
const memoryGb = os.totalmem() / 1024 ** 3;
const cpu = os.cpus()[0]?.model?.trim() || 'não identificado';

console.log(`CPU: ${cpu}`);
console.log(`Memória física: ${memoryGb.toFixed(1)} GB`);
console.log(
  memoryGb >= 30
    ? 'Perfil inicial sugerido: avaliar modelos locais de 7B/8B quantizados.'
    : memoryGb >= 14
      ? 'Perfil inicial sugerido: começar por modelo local de 3B/4B quantizado.'
      : 'Perfil inicial sugerido: manter Gemini como contingência; a memória é limitada para IA local.'
);

try {
  const url = new URL(rawUrl);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username || url.password || url.search || url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error('OLLAMA_BASE_URL deve apontar para o Ollama local.');
  }
  const response = await fetch(new URL('/api/tags', `${url.origin}/`), {
    signal: controller.signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  const models = Array.isArray(body?.models)
    ? body.models.map((model) => model?.name).filter((name) => typeof name === 'string')
    : [];
  console.log(`Ollama: ativo em ${url.origin}`);
  console.log(models.length ? `Modelos instalados: ${models.join(', ')}` : 'Nenhum modelo instalado.');
} catch (error) {
  const reason = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Ollama: indisponível em ${rawUrl} (${reason}).`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
}

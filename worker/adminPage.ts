// A página fica no próprio Worker para não criar outro site ou outra implantação.
// HTML, JavaScript e CSS são separados para manter uma CSP sem código inline.
const ADMIN_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEBOT | Feedback dos analistas</title>
  <link rel="stylesheet" href="/admin/styles.css">
</head>
<body>
  <main class="shell">
    <header class="header">
      <div>
        <span class="eyebrow">AEBOT</span>
        <h1>Feedback dos analistas</h1>
        <p>Consulta protegida dos relatos enviados pela extensão.</p>
      </div>
      <button id="logout" class="quiet hidden" type="button">Sair</button>
    </header>

    <section id="login-panel" class="panel">
      <h2>Acesso do responsável</h2>
      <p>Informe o token administrativo. Ele permanece apenas nesta aba.</p>
      <form id="login-form" class="login-form">
        <label for="token">Token administrativo</label>
        <input id="token" type="password" autocomplete="off" required>
        <button type="submit">Acessar feedbacks</button>
      </form>
    </section>

    <section id="feedback-panel" class="hidden">
      <div class="toolbar panel">
        <label for="category">Categoria</label>
        <select id="category">
          <option value="">Todas</option>
          <option value="resposta_incorreta">Resposta incorreta</option>
          <option value="regra_ausente">Regra ausente</option>
          <option value="dificuldade_entendimento">Difícil de entender</option>
          <option value="interface">Interface</option>
          <option value="sugestao">Sugestão</option>
          <option value="outro">Outro</option>
        </select>
        <button id="refresh" type="button">Atualizar</button>
        <button id="export" class="quiet" type="button">Exportar CSV</button>
      </div>
      <div id="summary" class="summary" aria-live="polite"></div>
      <div id="feedback-list" class="feedback-list"></div>
      <button id="load-more" class="quiet load-more hidden" type="button">Carregar mais</button>
    </section>

    <div id="message" class="message" role="status" aria-live="polite"></div>
  </main>
  <script src="/admin/app.js" defer></script>
</body>
</html>`;

const ADMIN_JS = `(() => {
  'use strict';
  const labels = {
    resposta_incorreta: 'Resposta incorreta',
    regra_ausente: 'Regra ausente',
    dificuldade_entendimento: 'Difícil de entender',
    interface: 'Interface',
    sugestao: 'Sugestão',
    outro: 'Outro'
  };
  const elements = {
    loginPanel: document.querySelector('#login-panel'),
    feedbackPanel: document.querySelector('#feedback-panel'),
    loginForm: document.querySelector('#login-form'),
    token: document.querySelector('#token'),
    logout: document.querySelector('#logout'),
    category: document.querySelector('#category'),
    refresh: document.querySelector('#refresh'),
    export: document.querySelector('#export'),
    summary: document.querySelector('#summary'),
    list: document.querySelector('#feedback-list'),
    loadMore: document.querySelector('#load-more'),
    message: document.querySelector('#message')
  };
  let currentFeedback = [];
  let nextOffset = null;

  const setMessage = (text, error = false) => {
    elements.message.textContent = text;
    elements.message.classList.toggle('error', error);
  };

  const setAuthenticated = (authenticated) => {
    elements.loginPanel.classList.toggle('hidden', authenticated);
    elements.feedbackPanel.classList.toggle('hidden', !authenticated);
    elements.logout.classList.toggle('hidden', !authenticated);
  };

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const render = (items, append) => {
    currentFeedback = append ? currentFeedback.concat(items) : items;
    if (!append) elements.list.replaceChildren();
    elements.summary.textContent = currentFeedback.length
      ? currentFeedback.length + (currentFeedback.length === 1 ? ' feedback exibido' : ' feedbacks exibidos')
      : 'Nenhum feedback encontrado.';
    for (const item of items) {
      const card = node('article', 'feedback-card');
      const top = node('div', 'feedback-top');
      top.append(
        node('span', 'category', labels[item.category] || item.category),
        node('time', '', new Date(item.createdAt).toLocaleString('pt-BR'))
      );
      const meta = node(
        'p',
        'meta',
        'Analista: ' + item.analystId + ' | Serviço: ' + item.serviceId + ' | Extensão: ' + item.appVersion
      );
      const message = node('p', 'feedback-message', item.message);
      card.append(top, meta, message);
      elements.list.append(card);
    }
  };

  const load = async (append = false) => {
    const token = sessionStorage.getItem('aebot_admin_token');
    if (!token) {
      setAuthenticated(false);
      return;
    }
    elements.refresh.disabled = true;
    setMessage('Carregando...');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (elements.category.value) params.set('category', elements.category.value);
      if (append && nextOffset !== null) params.set('offset', String(nextOffset));
      const response = await fetch('/v1/admin/feedback?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      if (response.status === 401) {
        sessionStorage.removeItem('aebot_admin_token');
        setAuthenticated(false);
        setMessage('Token administrativo inválido.', true);
        return;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const body = await response.json();
      render(Array.isArray(body.feedback) ? body.feedback : [], append);
      nextOffset = Number.isInteger(body.nextOffset) ? body.nextOffset : null;
      elements.loadMore.classList.toggle('hidden', nextOffset === null);
      setAuthenticated(true);
      setMessage('');
    } catch {
      setMessage('Não foi possível carregar os feedbacks.', true);
    } finally {
      elements.refresh.disabled = false;
    }
  };

  const csvCell = (value) => {
    const raw = String(value ?? '');
    const safe = /^\\s*[=+\\-@]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const exportCsv = () => {
    if (!currentFeedback.length) {
      setMessage('Não há feedbacks para exportar.', true);
      return;
    }
    const rows = [['data', 'analista', 'servico', 'categoria', 'versao', 'feedback']];
    for (const item of currentFeedback) {
      rows.push([
        item.createdAt,
        item.analystId,
        item.serviceId,
        labels[item.category] || item.category,
        item.appVersion,
        item.message
      ]);
    }
    const csv = '\\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\\r\\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aebot-feedbacks-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  elements.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = elements.token.value.trim();
    if (!token) return;
    sessionStorage.setItem('aebot_admin_token', token);
    elements.token.value = '';
    void load();
  });
  elements.logout.addEventListener('click', () => {
    sessionStorage.removeItem('aebot_admin_token');
    currentFeedback = [];
    render([], false);
    nextOffset = null;
    elements.loadMore.classList.add('hidden');
    setMessage('');
    setAuthenticated(false);
  });
  elements.refresh.addEventListener('click', () => { nextOffset = null; void load(false); });
  elements.category.addEventListener('change', () => { nextOffset = null; void load(false); });
  elements.loadMore.addEventListener('click', () => void load(true));
  elements.export.addEventListener('click', exportCsv);
  setAuthenticated(Boolean(sessionStorage.getItem('aebot_admin_token')));
  if (sessionStorage.getItem('aebot_admin_token')) void load();
})();`;

const ADMIN_CSS = `:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #070707;
  color: #f4f4f5;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #070707; }
button, input, select { font: inherit; }
.shell { width: min(940px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 64px; }
.header { display: flex; justify-content: space-between; gap: 24px; align-items: start; margin-bottom: 24px; }
.eyebrow { color: #4169e1; font-size: 12px; letter-spacing: .14em; font-weight: 700; }
h1 { font-size: clamp(26px, 5vw, 40px); margin: 6px 0; }
h2 { margin-top: 0; font-size: 18px; }
p { color: #a1a1aa; line-height: 1.5; }
.panel { background: #101010; border: 1px solid #252525; border-radius: 10px; padding: 18px; }
.login-form { display: grid; gap: 10px; max-width: 480px; }
label { font-size: 13px; font-weight: 650; }
input, select { background: #080808; border: 1px solid #303030; color: #f4f4f5; border-radius: 7px; padding: 10px; }
input:focus, select:focus { outline: 1px solid #4169e1; border-color: #4169e1; }
button { border: 0; border-radius: 7px; background: #4169e1; color: white; font-weight: 650; padding: 10px 14px; cursor: pointer; }
button:disabled { opacity: .5; cursor: wait; }
button.quiet { background: #181818; border: 1px solid #303030; color: #e4e4e7; }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.toolbar select { min-width: 190px; }
.summary { color: #a1a1aa; font-size: 13px; padding: 16px 2px 10px; }
.feedback-list { display: grid; gap: 10px; }
.feedback-card { background: #0d0d0d; border: 1px solid #242424; border-radius: 9px; padding: 15px; }
.feedback-top { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.category { color: #dbe4ff; background: #121b38; border: 1px solid #22376e; border-radius: 999px; padding: 4px 8px; font-size: 12px; }
time, .meta { color: #71717a; font-size: 12px; }
.meta { margin: 10px 0 4px; }
.feedback-message { white-space: pre-wrap; overflow-wrap: anywhere; margin: 7px 0 0; color: #f4f4f5; }
.message { min-height: 24px; padding-top: 12px; color: #a1a1aa; }
.message.error { color: #f87171; }
.load-more { display: block; margin: 16px auto 0; }
.hidden { display: none !important; }
@media (max-width: 600px) {
  .shell { width: min(100% - 20px, 940px); padding-top: 22px; }
  .header, .feedback-top { align-items: stretch; flex-direction: column; }
  .toolbar > * { width: 100%; }
}`;

const ADMIN_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

export function adminAssetResponse(path: string): Response | null {
  const commonHeaders = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': ADMIN_CSP,
  };
  if (path === '/admin' || path === '/admin/') {
    return new Response(ADMIN_HTML, {
      headers: { ...commonHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (path === '/admin/app.js') {
    return new Response(ADMIN_JS, {
      headers: { ...commonHeaders, 'Content-Type': 'text/javascript; charset=utf-8' },
    });
  }
  if (path === '/admin/styles.css') {
    return new Response(ADMIN_CSS, {
      headers: { ...commonHeaders, 'Content-Type': 'text/css; charset=utf-8' },
    });
  }
  return null;
}

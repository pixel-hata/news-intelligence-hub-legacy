/* ==========================================================================
   Pixel Hata — маленький сервер для сайту.
   1) Віддає сторінки з папки ../mockup.
   2) Приймає заявки з бота (POST /api/lead) і надсилає їх:
      • у ваш Telegram (бот → спільний канал або чат), з ТЗ окремим файлом;
      • на пошту (SMTP), з ТЗ у вкладенні;
      • і завжди дописує копію в server/data/leads.jsonl.
   Запуск: node server.js   (налаштування — у файлі .env, див. .env.example)
   Потрібен Node.js 18+. Для пошти: npm install (ставить nodemailer).
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');

/* ---------- налаштування з .env ---------- */
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const PORT = Number(process.env.PORT || 8080);
const SITE = path.resolve(__dirname, process.env.SITE_DIR || '../mockup');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const TG_API = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const MAIL_TO = process.env.MAIL_TO || '';
const DATA = path.join(__dirname, 'data');

/* ---------- відправка ---------- */
async function sendTelegram(text, tz, fileName) {
  if (!TG_TOKEN || !TG_CHAT) return false;
  const base = `${TG_API}/bot${TG_TOKEN}`;
  const r1 = await fetch(`${base}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: text.slice(0, 4000), disable_web_page_preview: true })
  });
  if (!r1.ok) throw new Error('telegram sendMessage ' + r1.status);
  if (tz) {
    const fd = new FormData();
    fd.append('chat_id', TG_CHAT);
    fd.append('caption', 'Попереднє ТЗ');
    fd.append('document', new Blob([tz], { type: 'text/markdown' }), fileName);
    const r2 = await fetch(`${base}/sendDocument`, { method: 'POST', body: fd });
    if (!r2.ok) throw new Error('telegram sendDocument ' + r2.status);
  }
  return true;
}

let mailer = null;
function getMailer() {
  if (mailer !== null) return mailer;
  if (!process.env.SMTP_HOST || !MAIL_TO) return (mailer = false);
  try {
    const nodemailer = require('nodemailer');
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } catch (e) {
    console.warn('Пошта вимкнена: виконайте npm install у папці server (потрібен nodemailer).');
    mailer = false;
  }
  return mailer;
}
async function sendEmail(subject, text, tz, fileName) {
  const m = getMailer();
  if (!m) return false;
  await m.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER, to: MAIL_TO, subject, text: text + (tz ? '\n\n' + tz : ''),
    attachments: tz ? [{ filename: fileName, content: tz, contentType: 'text/markdown; charset=utf-8' }] : []
  });
  return true;
}

/* ---------- захист від спаму: не більше 5 заявок за 10 хв з однієї адреси ---------- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 5;
}

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n);

async function handleLead(req, res, body) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
  if (limited(ip)) return json(res, 429, { ok: false, error: 'too_many' });
  let data;
  try { data = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: 'bad_json' }); }
  if (data.website) return json(res, 200, { ok: true, channels: [] });          // пастка для ботів-спамерів
  const lead = data.lead || {};
  const contact = lead.contact || {};
  if (!clean(contact.name, 100).trim() || !clean(contact.contact, 200).trim()) return json(res, 400, { ok: false, error: 'no_contact' });

  const id = clean(lead.id, 40) || 'L' + Date.now().toString(36);
  const title = clean(lead.title, 120) || 'Заявка';
  const tz = clean(data.tz, 60000);
  const message = clean(data.message, 3500) || `Нова заявка Pixel Hata\nКлієнт: ${clean(contact.name, 100)} · ${clean(contact.contact, 200)}`;
  const fileName = 'TZ-' + id + '.md';

  fs.mkdirSync(DATA, { recursive: true });
  fs.appendFileSync(path.join(DATA, 'leads.jsonl'), JSON.stringify({ receivedAt: new Date().toISOString(), ip, id, kind: clean(lead.kind, 20), title, contact: { name: clean(contact.name, 100), contact: clean(contact.contact, 200), comment: clean(contact.comment, 1000) }, question: clean(lead.question, 2000), estimate: lead.estimate || null, tz }) + '\n');

  const channels = [];
  await Promise.all([
    sendTelegram(message, tz, fileName).then(ok => ok && channels.push('telegram')).catch(e => console.error('Telegram:', e.message)),
    sendEmail(`${lead.kind === 'question' ? 'Питання' : 'Заявка'} Pixel Hata: ${title} — ${clean(contact.name, 100)}`, message, tz, fileName).then(ok => ok && channels.push('email')).catch(e => console.error('Email:', e.message))
  ]);
  const configured = (TG_TOKEN && TG_CHAT ? 1 : 0) + (getMailer() ? 1 : 0);
  // ok, якщо дійшло хоч кудись; якщо канали не налаштовані — заявка все одно збережена у файл
  json(res, 200, { ok: configured === 0 || channels.length > 0, channels, saved: true });
}

/* ---------- статичні файли ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp' };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(SITE, '.' + p);
  if (!file.startsWith(SITE + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Сторінку не знайдено'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && new URL(req.url, 'http://x').pathname === '/api/lead') {
    let body = '', size = 0;
    req.on('data', c => { size += c.length; if (size > 200 * 1024) { json(res, 413, { ok: false, error: 'too_big' }); req.destroy(); } else body += c; });
    req.on('end', () => { if (!res.writableEnded) handleLead(req, res, body).catch(e => { console.error(e); json(res, 500, { ok: false }); }); });
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  res.writeHead(405); res.end();
});
server.listen(PORT, () => {
  console.log(`Pixel Hata: http://localhost:${PORT}`);
  console.log(`Telegram: ${TG_TOKEN && TG_CHAT ? 'увімкнено' : 'не налаштовано'} · Пошта: ${process.env.SMTP_HOST && MAIL_TO ? 'увімкнено' : 'не налаштовано'} · Копії заявок: server/data/leads.jsonl`);
});

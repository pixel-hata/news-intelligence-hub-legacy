/* ==========================================================================
   Pixel Hub — «навчання» бота без AI.
   1. Бот записує кожне повідомлення, яке не зрозумів, і кожне «не те».
   2. Якщо після «не зрозумів» клієнт сам натиснув потрібну тему — бот
      запамʼятовує це як підказку («мабуть, це про Оплату»).
   3. Команда в admin.html → «Навчання бота» одним кліком додає фразу
      до існуючої відповіді або пише нову відповідь. Бот одразу її знає.
   У макеті все зберігається в браузері; на справжньому сайті — на сервері,
   тож питання всіх клієнтів збираються в одному місці.
   ========================================================================== */
window.PHLearn = (function () {
  const KU = "pixelhub.unknown.v1", KL = "pixelhub.learned.v1";
  const D = window.PH_DATA;
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const normKey = s => String(s).toLowerCase().replace(/[’`ʼ']/g, "'").replace(/[^\p{L}\p{N}'@+.\s-]/gu, " ").replace(/\s+/g, " ").trim();

  function learned() {
    const l = read(KL, {});
    return { extraKeys: l.extraKeys || {}, custom: Array.isArray(l.custom) ? l.custom : [], ignored: Array.isArray(l.ignored) ? l.ignored : [] };
  }
  function saveLearned(l) { return write(KL, l); }

  /* FAQ, з яким працює бот: базовий + вивчене */
  function faqs() {
    const l = learned();
    const base = D.FAQ.map(f => Object.assign({}, f, { keys: f.keys.concat(l.extraKeys[f.id] || []) }));
    const custom = l.custom.map(c => ({ id: c.id, title: c.title, keys: c.keys, text: c.text, next: c.next || ["menu", "human"], custom: true }));
    return custom.concat(base);
  }

  /* журнал нерозпізнаних */
  function unknown() { const v = read(KU, []); return Array.isArray(v) ? v : []; }
  function bump(text, patch) {
    const n = normKey(text); if (!n || n.length < 2) return;
    if (learned().ignored.includes(n)) return;
    const arr = unknown();
    let it = arr.find(x => x.n === n && x.kind === patch.kind && (x.faqId || "") === (patch.faqId || ""));
    if (it) { it.count++; it.last = new Date().toISOString(); if (patch.ctx) it.ctx = patch.ctx; }
    else { it = Object.assign({ n, text: String(text).slice(0, 400), count: 1, first: new Date().toISOString(), last: new Date().toISOString() }, patch); arr.unshift(it); }
    write(KU, arr.slice(0, 500));
  }
  const logUnknown = (text, ctx) => bump(text, { kind: "unknown", ctx: ctx || "" });
  const logWrong = (text, faqId) => bump(text, { kind: "wrong", faqId });
  function suggest(text, faqId) {
    const n = normKey(text), arr = unknown();
    const it = arr.find(x => x.n === n && x.kind === "unknown");
    if (it) { it.suggest = faqId; write(KU, arr); }
  }
  function dropUnknown(n) { write(KU, unknown().filter(x => x.n !== n)); }

  /* дії команди */
  function addKeys(faqId, keys) {
    const l = learned();
    const clean = keys.map(normKey).filter(k => k.length >= 2);
    const c = l.custom.find(x => x.id === faqId);
    if (c) c.keys = [...new Set(c.keys.concat(clean))];
    else l.extraKeys[faqId] = [...new Set((l.extraKeys[faqId] || []).concat(clean))];
    return saveLearned(l);
  }
  function addCustom(title, text, keys) {
    const l = learned();
    const id = "c_" + Date.now().toString(36);
    l.custom.push({ id, title: String(title).trim() || "Нова відповідь", text: String(text).trim(), keys: [...new Set(keys.map(normKey).filter(k => k.length >= 2))], createdAt: new Date().toISOString() });
    saveLearned(l); return id;
  }
  function updateCustom(id, patch) {
    const l = learned(); const c = l.custom.find(x => x.id === id); if (!c) return false;
    if (patch.title != null) c.title = patch.title;
    if (patch.text != null) c.text = patch.text;
    if (patch.keys) c.keys = [...new Set(patch.keys.map(normKey).filter(k => k.length >= 2))];
    return saveLearned(l);
  }
  function removeCustom(id) { const l = learned(); l.custom = l.custom.filter(x => x.id !== id); return saveLearned(l); }
  function removeKey(faqId, key) { const l = learned(); l.extraKeys[faqId] = (l.extraKeys[faqId] || []).filter(k => k !== key); return saveLearned(l); }
  function ignore(n) { const l = learned(); if (!l.ignored.includes(n)) l.ignored.push(n); saveLearned(l); dropUnknown(n); }

  /* перенесення знань між браузерами / на сервер */
  const exportJson = () => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), learned: learned(), unknown: unknown() }, null, 2);
  function importJson(text) {
    const o = JSON.parse(text);
    if (!o || !o.learned) throw new Error("Це не файл знань бота");
    const cur = learned(), inc = o.learned;
    Object.keys(inc.extraKeys || {}).forEach(id => { cur.extraKeys[id] = [...new Set((cur.extraKeys[id] || []).concat(inc.extraKeys[id]))]; });
    (inc.custom || []).forEach(c => { if (!cur.custom.some(x => x.id === c.id)) cur.custom.push(c); });
    (inc.ignored || []).forEach(n => { if (!cur.ignored.includes(n)) cur.ignored.push(n); });
    saveLearned(cur);
    return true;
  }

  /* розпізнавання питання (той самий алгоритм, що в боті) */
  const pad = s => " " + normKey(s) + " ";
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function keyScore(t, words, key) {
    const k = key.toLowerCase();
    if (t.includes(k)) return k.trim().length;
    const kt = k.trim();
    if (kt.length < 5 || kt.includes(" ")) return 0;
    return words.some(w => w.length >= kt.length - 1 && lev(w.slice(0, kt.length), kt) <= 1) ? kt.length - 1 : 0;
  }
  /* точні збіги рахуються повністю; одруківки — тільки для слів, які ще не збіглися точно */
  function faqScore(t, words, f) {
    let s = 0; const used = new Set();
    f.keys.forEach(key => { const k = key.toLowerCase(); if (t.includes(k)) { s += k.trim().length; words.forEach((w, i) => { if ((" " + w + " ").includes(k.trim()) || w.startsWith(k.trim())) used.add(i); }); } });
    f.keys.forEach(key => {
      const kt = key.toLowerCase().trim();
      if (kt.length < 7 || kt.includes(" ") || t.includes(key.toLowerCase())) return;
      const i = words.findIndex((w, j) => !used.has(j) && w.length >= kt.length - 1 && lev(w.slice(0, kt.length), kt) <= 1);
      if (i >= 0) { used.add(i); s += kt.length - 1; }
    });
    return s;
  }
  function match(text) {
    const t = pad(text), words = t.trim().split(" "); let best = null, score = 0;
    faqs().forEach(f => { const s = faqScore(t, words, f); if (s > score) { score = s; best = f; } });
    return best;
  }
  const LABELS = { hello: "Привітання", prices: "Ціни", rate: "Ставка", included: "Що входить у ціну", cheaper: "Як зробити дешевше", timing: "Терміни", urgent: "Терміново", process: "Як ми працюємо", payment: "Оплата", installments: "Оплата частинами", contract: "Договір і NDA", hosting: "Хостинг і домен", ownership: "Кому належить код", support: "Підтримка", warranty: "Гарантія", edits: "Правки", portfolio: "Портфоліо", ready: "Готові роботи", team: "Хто ви", stack: "Технології", cms: "WordPress / Tilda", admin: "Адмін-панель", mobile: "Мобільна версія", app: "Мобільний застосунок", seo: "SEO", content: "Тексти і фото", languages: "Мови", integrations: "Інтеграції", ai: "AI", redesign: "Редизайн", security: "Безпека", meeting: "Дзвінок", schedule: "Графік роботи", where: "Де ви працюєте", contacts: "Контакти", news: "IT-новини", bot: "Ти бот?", thanks: "Дякую", bye: "Прощання", niche: "Ваша сфера бізнесу", start: "Коли почнете", need_from_client: "Що потрібно від клієнта", have_tz: "Є готове ТЗ", no_tz: "Немає ТЗ", uah: "Гривні і курс", company: "Документи для ТОВ/ФОП", refund: "Повернення коштів", late: "Затримка термінів", training: "Навчання", grow: "Розширення потім", speed: "Швидкість сайту", analytics: "Аналітика", marketplaces: "Prom / Rozetka / Instagram", ready_crm: "Готова CRM чи своя", mail: "Пошта на домені", widgets: "Карта, чат, месенджери", pwa: "PWA / десктоп", games: "Ігри", crypto: "Крипто", jobs: "Вакансії", partner: "Співпраця", charity: "Волонтерам і студентам", rights: "Авторські права", stock: "Фотобанки", migration: "Перенос сайту", domain_pick: "Вибір домену", a11y: "Доступність", progress: "Як слідкувати за роботою", copy_site: "Як у іншому сайті", reviews: "Відгуки", refuse: "Незаконні задачі", offtopic: "Не по темі" };
  const title = f => (f && (LABELS[f.id] || f.title)) || (f ? String(f.text).slice(0, 40) + "…" : "");

  return { faqs, match, title, unknown, logUnknown, logWrong, suggest, dropUnknown, addKeys, addCustom, updateCustom, removeCustom, removeKey, ignore, learned, exportJson, importJson, normKey };
})();

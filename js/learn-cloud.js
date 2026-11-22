/* Спільна памʼять бота в Supabase.
   - Нерозпізнані питання всіх відвідувачів записуються в таблицю bot_unknown — команда бачить їх у кабінеті.
   - Те, чого команда навчила бота в кабінеті, зберігається в bot_knowledge і підтягується всім відвідувачам.
   Таблиці і правила доступу — у docs/supabase-bot.sql. Без таблиць бот працює як раніше (тільки в браузері). */
(function () {
  const L = window.PHLearn, cfg = window.PH_AUTH || {};
  if (!L || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.fetch) return;
  const API = cfg.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/";
  const KL = "pixelhub.learned.v1", KU = "pixelhub.unknown.v1";
  const token = () => window.PH_AUTH_TOKEN || cfg.SUPABASE_ANON_KEY;   // у кабінеті — токен команди після входу
  const H = extra => Object.assign({ apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + token(), "Content-Type": "application/json" }, extra || {});
  const req = (path, opt) => fetch(API + path, Object.assign({}, opt, { headers: H(opt && opt.headers) })).then(r => r.ok ? (r.status === 204 ? null : r.json().catch(() => null)) : Promise.reject(r.status));
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const ping = () => { try { window.dispatchEvent(new Event("phlearn:sync")); } catch (e) {} };
  const isAdmin = () => !!document.getElementById("gate");

  /* 1. Знання команди → усім відвідувачам */
  let cloudSeen = false;
  function pullKnowledge() {
    return req("bot_knowledge?id=eq.1&select=data,updated_at").then(rows => {
      cloudSeen = true;
      const d = rows && rows[0] && rows[0].data;
      if (d && typeof d === "object") { write(KL, { extraKeys: d.extraKeys || {}, custom: d.custom || [], ignored: d.ignored || [] }); ping(); }
      else if (isAdmin() && window.PH_AUTH_TOKEN) { const l = L.learned(); if (l.custom.length || Object.keys(l.extraKeys).length) pushKnowledge(); }
    }).catch(() => {});
  }
  function pushKnowledge() {
    if (!window.PH_AUTH_TOKEN) return Promise.resolve();
    const body = JSON.stringify([{ id: 1, data: L.learned(), updated_at: new Date().toISOString(), updated_by: window.PH_AUTH_EMAIL || "" }]);
    return req("bot_knowledge?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body })
      .then(() => setStatus("Збережено в Supabase — бот уже знає це на сайті."))
      .catch(e => setStatus("Не вдалося зберегти в Supabase (" + e + "). Перевірте, чи створені таблиці з docs/supabase-bot.sql.", true));
  }
  function setStatus(t, bad) {
    const s = document.getElementById("cloudStatus"); if (!s) return;
    s.textContent = t; s.style.color = bad ? "#FFB3A6" : "#9FE6C4";
  }
  ["addKeys", "addCustom", "updateCustom", "removeCustom", "removeKey", "ignore", "importJson"].forEach(name => {
    const orig = L[name]; if (typeof orig !== "function") return;
    L[name] = function () { const r = orig.apply(L, arguments); if (isAdmin()) pushKnowledge(); return r; };
  });

  /* 2. Нерозпізнані питання → у кабінет команди */
  let sent = 0;
  function sendUnknown(text, kind, ctx, faqId) {
    if (isAdmin() || sent >= 30) return;   // не логуємо перевірки команди; не більше 30 записів за візит
    sent++;
    const row = { n: L.normKey(text).slice(0, 300), text: String(text).slice(0, 400), kind, ctx: String(ctx || "").slice(0, 200), faq_id: faqId || null, page: location.pathname.split("/").pop() || "index.html" };
    req("bot_unknown", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) }).catch(() => {});
  }
  const oU = L.logUnknown, oW = L.logWrong;
  L.logUnknown = function (text, ctx) { oU.apply(L, arguments); sendUnknown(text, "unknown", ctx); };
  L.logWrong = function (text, faqId) { oW.apply(L, arguments); sendUnknown(text, "wrong", "", faqId); };

  function pullUnknown() {
    if (!window.PH_AUTH_TOKEN) return Promise.resolve();
    return req("bot_unknown?select=n,text,kind,ctx,faq_id,created_at&order=created_at.desc&limit=1000").then(rows => {
      const ignored = (L.learned().ignored || []);
      const map = new Map();
      read(KU, []).forEach(it => map.set(it.kind + "|" + it.n + "|" + (it.faqId || ""), it));
      (rows || []).forEach(r => {
        if (!r.n || ignored.includes(r.n)) return;
        const key = r.kind + "|" + r.n + "|" + (r.faq_id || "");
        const it = map.get(key);
        if (it && it.cloud) { it.count++; if (r.created_at < it.first) it.first = r.created_at; }
        else if (it) { it.cloud = true; }
        else map.set(key, { n: r.n, text: r.text, kind: r.kind, ctx: r.ctx || "", faqId: r.faq_id || undefined, count: 1, first: r.created_at, last: r.created_at, cloud: true });
      });
      write(KU, [...map.values()].sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 500));
      setStatus("Підключено до Supabase: питань від клієнтів — " + (rows || []).length + ". Усе, чого ви навчите, одразу працює на сайті.");
      ping();
    }).catch(e => setStatus("Не вдалося прочитати питання клієнтів із Supabase (" + e + "). Створіть таблиці з docs/supabase-bot.sql.", true));
  }
  // прибрати з хмари те, що команда вже обробила
  ["dropUnknown", "ignore"].forEach(name => {
    const orig = L[name];
    L[name] = function (n) { const r = orig.apply(L, arguments); if (window.PH_AUTH_TOKEN && n) req("bot_unknown?n=eq." + encodeURIComponent(n), { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {}); return r; };
  });

  window.PHLearnCloud = { pullKnowledge, pushKnowledge, pullUnknown, seen: () => cloudSeen };
  if (isAdmin()) {
    // у кабінеті — після входу: спершу знання з хмари, потім питання клієнтів
    window.addEventListener("ph:signedin", () => { pullKnowledge().then(pullUnknown); setStatus("Синхронізація з Supabase…"); });
  } else {
    pullKnowledge();
  }
})();

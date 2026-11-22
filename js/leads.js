/* ==========================================================================
   Pixel Hata — заявки і попереднє ТЗ (макет).
   У макеті заявки зберігаються в браузері (localStorage).
   На справжньому сайті цю частину замінить сервер: база + Telegram-канал + пошта.
   ========================================================================== */
window.PHLeads = (function () {
  const KEY = "pixelhub.leads.v1";
  const D = window.PH_DATA;

  function list() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function write(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
  }
  function save(lead) {
    const arr = list().filter(l => l.id !== lead.id);
    arr.unshift(lead);
    return write(arr.slice(0, 300));
  }
  function remove(id) { return write(list().filter(l => l.id !== id)); }
  function clear() { return write([]); }

  const money = n => "$" + Math.round(n).toLocaleString("en-US");
  const dt = s => { try { return new Date(s).toLocaleString("uk-UA"); } catch (e) { return s; } };
  const fill = t => String(t)
    .replace(/\$\{(\w+)\}/g, (m, k) => k in D.STUDIO ? "$" + D.STUDIO[k] : m)
    .replace(/\{(\w+)\}/g, (m, k) => k in D.STUDIO ? D.STUDIO[k] : m);

  /* Попереднє ТЗ за шаблоном — з відповідей клієнта, без AI */
  function buildTz(lead) {
    const L = [];
    const e = lead.estimate;
    L.push("# " + (lead.title || "Заявка") + " — попереднє ТЗ");
    L.push("");
    L.push("- Дата: " + dt(lead.createdAt));
    if (lead.contact) L.push("- Клієнт: " + lead.contact.name + " · " + lead.contact.contact);
    L.push("- Джерело: бот на сайті Pixel Hata");
    L.push("- Статус: попередня оцінка, потрібен дзвінок для уточнення");
    if (lead.description) { L.push(""); L.push("## Опис від клієнта"); L.push(lead.description); }
    if (lead.contact && lead.contact.comment) { L.push(""); L.push("## Коментар клієнта"); L.push(lead.contact.comment); }
    if (lead.answers && lead.answers.length) {
      L.push(""); L.push("## Що потрібно зробити");
      lead.answers.forEach(a => (a.tz || []).forEach(t => { if (t) L.push("- " + fill(t)); }));
      L.push(""); L.push("## Відповіді клієнта");
      lead.answers.forEach(a => L.push("- " + a.question + " → " + a.labels.join(", ")));
    }
    if (e) {
      L.push(""); L.push("## Попередня оцінка");
      L.push("| Роботи | Години | Вартість |");
      L.push("|---|---|---|");
      e.items.forEach(i => L.push("| " + i.item + " | " + i.h[0] + "–" + i.h[1] + " | " + money(i.h[0] * D.STUDIO.rateMin * e.mult) + " – " + money(i.h[1] * D.STUDIO.rateMax * e.mult) + " |"));
      L.push("| **Разом** | **" + e.ha + "–" + e.hb + "** | **" + money(e.priceMin) + " – " + money(e.priceMax) + "** |");
      L.push("");
      L.push("- Ставка: $" + D.STUDIO.rateMin + "–" + D.STUDIO.rateMax + " за годину" + (e.mult > 1 ? ", терміново ×" + e.mult : ""));
      L.push("- Термін: " + e.weeks);
      if (e.mvp) L.push("- Мінімальна версія (без додаткових функцій): " + money(e.mvp.priceMin) + " – " + money(e.mvp.priceMax));
    }
    L.push(""); L.push("## Не входить у вартість");
    L.push("- Хостинг (сервер) і домен — оплачує клієнт напряму провайдеру");
    L.push("- Платні сервіси: SMS, комісії платіжних систем, платні API — оплачує клієнт");
    const open = [];
    (lead.answers || []).forEach(a => { if (a.labels.some(x => /не знаю|порадьте/i.test(x))) open.push("Уточнити: " + a.question.replace(/\?.*$/, "?")); });
    open.push("Приклади сайтів/сервісів, які подобаються клієнту");
    open.push("Бажана дата запуску");
    if (!lead.contact) open.push("Контакт клієнта");
    L.push(""); L.push("## Відкриті питання");
    open.forEach(o => L.push("- " + o));
    L.push(""); L.push("> " + D.NOTE);
    return L.join("\n");
  }

  /* Короткий текст для Telegram-каналу */
  function telegramText(lead) {
    const e = lead.estimate;
    return [
      lead.kind === "question" ? "❓ Питання з сайту Pixel Hata" : "🟠 Нова заявка Pixel Hata",
      lead.contact ? "Клієнт: " + lead.contact.name + " · " + lead.contact.contact : "",
      lead.title ? "Проєкт: " + lead.title : "",
      e ? "Оцінка: " + money(e.priceMin) + " – " + money(e.priceMax) + ", " + e.weeks : "",
      lead.question ? "Питання: " + lead.question : "",
      lead.contact && lead.contact.comment ? "Коментар: " + lead.contact.comment : "",
      "Час: " + dt(lead.createdAt)
    ].filter(Boolean).join("\n");
  }

  /* Відправка команді: на справжньому сайті — у Telegram і на пошту через сервер (server/).
     Відкритий як файл (file://) макет просто зберігає заявку в браузері. */
  async function send(lead) {
    if (!/^https?:$/.test(location.protocol)) return { ok: false, offline: true };
    try {
      const r = await fetch("api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: { id: lead.id, kind: lead.kind, title: lead.title, contact: lead.contact, question: lead.question || "", estimate: lead.estimate ? { priceMin: lead.estimate.priceMin, priceMax: lead.estimate.priceMax, weeks: lead.estimate.weeks } : null, createdAt: lead.createdAt },
          tz: lead.tz || "", message: telegramText(lead), website: "" }) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok && j.ok !== false, channels: j.channels || [] };
    } catch (e) { return { ok: false }; }
  }

  return { list, save, send, remove, clear, buildTz, telegramText, fill, money };
})();

/* ==========================================================================
   Pixel Hata — бот-помічник без AI.
   Логіка: меню → відповіді на питання (FAQ) або сценарій оцінки → заявка.
   Весь текст бота лежить у bot-data.js.
   ========================================================================== */
(function () {
  const D = window.PH_DATA, LEADS = window.PHLeads, S = D.STUDIO;
  const log = document.getElementById("botLog");
  const form = document.getElementById("botForm");
  const input = document.getElementById("botInput");
  if (!log || !form || !input) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fill = LEADS.fill, money = LEADS.money;

  /* ---------- state ---------- */
  let st = { mode: "idle" };          // idle | estimate | contact | human
  const transcript = [];
  let formN = 0;

  /* ---------- rendering ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const md = s => esc(fill(s)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function userMsg(text) {
    const d = el("div", "msg me", text); log.append(d); transcript.push({ role: "user", text }); scroll();
  }
  function clearButtons() { log.querySelectorAll(".chips").forEach(c => c.remove()); }

  let queue = Promise.resolve();
  function say(text, buttons) {
    queue = queue.then(() => new Promise(res => {
      const typing = el("div", "msg bot"); typing.innerHTML = '<span class="typing" aria-label="Бот друкує"><i></i><i></i><i></i></span>';
      log.append(typing); scroll();
      const delay = reduce ? 80 : Math.min(900, 280 + String(text).length * 4);
      setTimeout(() => {
        typing.remove();
        const d = el("div", "msg bot"); d.innerHTML = md(text); log.append(d);
        transcript.push({ role: "bot", text: fill(text).replace(/\*\*/g, "") });
        if (buttons) renderButtons(buttons);
        scroll(); res();
      }, delay);
    }));
    return queue;
  }
  function after(fn) { queue = queue.then(() => { fn(); scroll(); }); return queue; }

  /* buttons: [{label, action}] or "menu" */
  function renderButtons(btns) {
    if (btns === "menu") btns = D.MENU;
    btns = btns.map(b => typeof b === "string" ? actionToButton(b) : b).filter(Boolean);
    if (!btns.length) return;
    const w = el("div", "chips");
    btns.forEach(b => {
      const x = el("button", "chip", b.label); x.type = "button";
      x.addEventListener("click", () => {
        clearButtons(); userMsg(b.label);
        if (st.lastUnknown && LEARN && b.action.startsWith("faq:")) LEARN.suggest(st.lastUnknown, b.action.slice(4));
        if (b.action !== "wrong") st.lastUnknown = null;
        run(b.action);
      });
      w.append(x);
    });
    log.append(w);
  }
  function actionToButton(a) {
    if (a === "menu") return { label: "Меню", action: "menu" };
    if (a === "estimate") return { label: "Порахувати вартість", action: "estimate" };
    if (a === "human") return { label: "Написати людині", action: "human" };
    if (a.startsWith("faq:")) { const f = faqById(a.slice(4)); return f ? { label: FAQ_LABEL[f.id] || (LEARN ? LEARN.title(f) : f.id), action: a } : null; }
    return null;
  }
  const FAQ_LABEL = { prices: "Ціни", rate: "Ставка", included: "Що входить у ціну?", cheaper: "Як зробити дешевше?", timing: "Терміни", urgent: "Терміново", process: "Як ми працюємо", payment: "Оплата", installments: "Оплата частинами", contract: "Договір", hosting: "Хостинг і домен", ownership: "Кому належить код", support: "Підтримка", warranty: "Гарантія", edits: "Правки", portfolio: "Портфоліо", ready: "Готові роботи", team: "Хто ви", stack: "Технології", cms: "WordPress / Tilda", admin: "Адмін-панель", mobile: "Мобільна версія", app: "Мобільний застосунок", seo: "SEO", content: "Тексти і фото", languages: "Мови", integrations: "Інтеграції", ai: "AI", redesign: "Редизайн", security: "Безпека", meeting: "Дзвінок", schedule: "Графік роботи", where: "Де ви працюєте", contacts: "Контакти", news: "IT-новини", bot: "Хто відповідає" };

  /* ---------- text understanding (keywords, no AI) ---------- */
  const norm = s => " " + String(s).toLowerCase().replace(/[’`ʼ']/g, "'").replace(/[^\p{L}\p{N}'@+.\s-]/gu, " ").replace(/\s+/g, " ").trim() + " ";
  const LEARN = window.PHLearn;
  const allFaqs = () => (LEARN ? LEARN.faqs() : D.FAQ);
  const faqById = id => allFaqs().find(f => f.id === id);
  /* відстань Левенштейна — щоб розуміти слова з одруківками */
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
  function matchFaq(text) {
    if (LEARN && LEARN.match) return LEARN.match(text);
    const t = norm(text), words = t.trim().split(" "); let best = null, score = 0;
    allFaqs().forEach(f => {
      let s = 0; f.keys.forEach(k => { s += keyScore(t, words, k); });
      if (s > score) { score = s; best = f; }
    });
    return best;
  }
  const TYPE_KEYS = {
    landing: ["лендінг", "лендинг", "landing", "односторінк", "одностраничн", "посадков"],
    site: ["власний сайт", "свій сайт", "свой сайт", "хочу сайт", "сайт-візитк", "сайт визитк", "візитк", "визитк", "корпоратив", "сайт компан", "багатосторін", "многостранич", "сайт для", "сайт"],
    shop: ["доставка їжі", "доставка еды", "замовлення їжі", "магазин", "shop", "товар", "e-commerce", "ecommerce", "продаж онлайн"],
    crm: ["crm", "срм", "црм", "облік", "учет", "систему для", "система для", "erp"],
    bot: [" бот ", " бота", "телеграм-бот", "telegram-бот", "telegram бот", "телеграм бот", " bot "],
    webapp: ["онлайн-школ", "онлайн школ", "навчальна платформ", "lms", "сервіс", "сервис", "платформ", "веб-застосун", "веб-прилож", "saas", "кабінет", "кабинет", "маркетплейс"],
    design: ["тільки дизайн", "только дизайн", "дизайн макет", "макет", "figma", "фігма", " ui ", " ux "],
    brand: ["ребрендинг", "вивіск", "упаковк", "лого", "logo", "брендбук", "фірмов", "фирмен", "айдентик"],
    auto: ["автоматиз", "ексел", "excel", "таблиц", "google sheets", "гугл таблиц", "документообіг", "ттн", "накладн", "договор", "рахунк", "скан", "ocr", "парс", "збір даних", "кадастр", "звіря"],
    ai: [" ai ", "ші ", "нейро", "gpt", "штучн", "искусствен"],
    redesign: ["адаптувати під телефон", "адаптировать под телефон", "мобільна адаптац", "з мого макета", "по моему макету", "редизайн", "переробит", "переделат", "доробит", "доделат", "старий сайт", "старый сайт"]
  };
  const ORDER = ["redesign", "crm", "shop", "landing", "bot", "auto", "webapp", "brand", "ai", "design", "site"];
  function detectType(text) {
    const t = norm(text); let best = null, score = 0;
    ORDER.forEach(id => {
      let sc = 0;
      TYPE_KEYS[id].forEach(k => { const n = t.split(k).length - 1; if (n) sc += n * k.trim().length; });
      if (sc > score) { score = sc; best = id; }
    });
    return best;
  }
  /* читання довгого опису: які відповіді вже зрозумілі */
  function analyze(type, text) {
    const t = norm(text), pre = {};
    type.questions.forEach(q => {
      if (!q.options) return;
      const hits = q.options.map((o, i) => [i, (o.kw || []).filter(k => t.includes(k.toLowerCase())).length]).filter(x => x[1] > 0);
      if (!hits.length) return;
      if (q.multi) pre[q.id] = hits.map(x => x[0]);
      else pre[q.id] = [hits.sort((a, b) => b[1] - a[1])[0][0]];
    });
    return pre;
  }
  const WANT = ["хочу", "потрібен", "потрібна", "потрібно", "потрібне", "треба", "нужен", "нужна", "нужно", "зробіть", "зробити", "сделайте", "сделать", "розробити", "разработать", "замовити", "заказать", "need", "want", "порахуй", "порахув", "посчита", "оцін", "оцен", "скільки коштує", "сколько стоит"];
  const wantsBuild = text => { const t = norm(text); return WANT.some(w => t.includes(w)); };
  const CMD = {
    menu: ["меню", "menu", "почати спочатку", "спочатку", "заново", "сначала", "restart", "старт", "/start"],
    back: ["назад", "back", "повернутись", "вернуться"],
    human: ["людин", "оператор", "менеджер", "живий", "живой", "human", "консультант"],
    estimate: ["порахуй", "порахув", "посчита", "оцінк", "оценк", "калькул", "розрахув", "рассчит"]
  };
  const isShort = text => norm(text).trim().split(" ").length <= 5;
  const isCmd = (text, k) => { if (!isShort(text)) return false; const t = norm(text); return CMD[k].some(w => t.includes(w)); };

  /* ---------- actions ---------- */
  function run(action, extra) {
    if (action === "menu") return showMenu();
    if (action === "estimate") return chooseType();
    if (action === "human") return humanForm();
    if (action.startsWith("type:")) return startEstimate(action.slice(5), extra || st.description || "");
    if (action.startsWith("faq:")) return answerFaq(faqById(action.slice(4)));
    if (action === "wrong") return markWrong();
    if (action === "send") return contactForm();
    if (action === "mvp") return showMvp();
    if (action === "redo") { const d = st.description; st.description = ""; startEstimate(st.typeId, ""); st.description = d; return; }
    if (action === "copy") return copyEstimate();
    if (action === "tz") return showTz();
  }
  function showMenu() { st = { mode: "idle" }; say("Чим можу допомогти?", "menu"); }
  function answerFaq(f, fromText) {
    if (!f) return fallback();
    if (fromText) {
      st.lastAsked = fromText; st.lastFaq = f.id;
      let nx = f.next || "menu"; if (nx === "menu") nx = D.MENU.slice();
      return say(f.text, nx.concat([{ label: "Це не те, що я питав", action: "wrong" }]));
    }
    say(f.text, f.next || "menu");
  }
  let fbN = 0;
  function fallback(text) {
    if (text && LEARN) { LEARN.logUnknown(text, st.mode); st.lastUnknown = text; }
    say(D.FALLBACK[fbN++ % D.FALLBACK.length] + (text ? "\n\nЯ записав ваше питання — команда навчить мене на нього відповідати." : ""), D.MENU.concat([]));
  }
  function chooseType() {
    st = { mode: "pick", description: "" };
    say("Що будемо робити? Оберіть тип проєкту:", D.TYPES.map(t => ({ label: t.label, action: "type:" + t.id })));
  }

  /* ---------- estimate flow ---------- */
  function startEstimate(typeId, description) {
    const type = D.TYPES.find(t => t.id === typeId); if (!type) return chooseType();
    const desc = description || st.description || "";
    st = { mode: "estimate", typeId, type, qi: 0, answers: [], description: desc, pre: desc ? analyze(type, desc) : {}, autoSaid: false, auto: [] };
    if (Object.keys(st.pre).length) {
      const got = [];
      type.questions.forEach(q => { (st.pre[q.id] || []).forEach(i => { const o = q.options[i]; if (o && !o.none) got.push(fill(o.tz || o.label)); }); });
      st.autoSaid = true;
      say("**" + type.label + "** — дякую за детальний опис! З нього я вже зрозумів:\n" + got.map(g => "• " + g).join("\n") + "\n\nСпитаю лише про те, чого бракує. Якщо щось не так — у кінці натисніть «Змінити відповіді».");
    }
    else say("**" + type.label + "** — чудово. Кілька коротких питань, і я порахую попередню вартість. Можна відповідати кнопками або словами; «назад» — повернутись до попереднього питання.");
    askQuestion();
  }
  function curQ() { return st.type.questions[st.qi]; }
  function askQuestion() {
    let q = curQ();
    // питання з однією відповіддю, яку вже видно з опису, — відповідаємо самі
    while (q && !q.multi && !q.free && st.pre && st.pre[q.id] && !st.answers[st.qi]) {
      const idx = st.pre[q.id];
      st.auto.push(q.options[idx[0]].label);
      recordAnswer(q, idx); st.qi++; q = curQ();
    }
    if (st.auto.length && !st.autoSaid) {
      st.autoSaid = true;
      say("З вашого опису я вже зрозумів:\n" + st.auto.map(a => "• " + a).join("\n") + "\n\nЯкщо щось не так — у кінці натисніть «Змінити відповіді».");
    }
    if (!q) return finishEstimate();
    const num = "Питання " + (st.qi + 1) + " з " + st.type.questions.length + ". ";
    if (q.free) { say(num + q.text); return; }
    const preMulti = q.multi && st.pre && st.pre[q.id] && st.pre[q.id].length;
    say(num + q.text + (q.hint ? "\n\n" + q.hint : "") + (preMulti ? "\n\nЯ вже відмітив те, що побачив у вашому описі. Перевірте, додайте потрібне і натисніть «Готово»." : ""));
    after(() => renderOptions(q));
  }
  function renderOptions(q) {
    const w = el("div", "chips");
    if (!q.multi) {
      q.options.forEach((o, i) => {
        const b = el("button", "chip", o.label); b.type = "button";
        b.addEventListener("click", () => { clearButtons(); userMsg(o.label); answer([i]); });
        w.append(b);
      });
    } else {
      const picked = new Set((st.pre && st.pre[q.id]) || []);
      q.options.forEach((o, i) => {
        const b = el("button", "chip toggle", o.label); b.type = "button"; b.setAttribute("aria-pressed", String(picked.has(i)));
        b.addEventListener("click", () => {
          if (o.none) { picked.clear(); w.querySelectorAll(".toggle").forEach(x => x.setAttribute("aria-pressed", "false")); picked.add(i); b.setAttribute("aria-pressed", "true"); return; }
          const noneIdx = q.options.findIndex(x => x.none);
          if (noneIdx >= 0 && picked.has(noneIdx)) { picked.delete(noneIdx); w.children[noneIdx].setAttribute("aria-pressed", "false"); }
          if (picked.has(i)) { picked.delete(i); b.setAttribute("aria-pressed", "false"); } else { picked.add(i); b.setAttribute("aria-pressed", "true"); }
        });
        w.append(b);
      });
      const done = el("button", "chip done", "Готово →"); done.type = "button";
      done.addEventListener("click", () => {
        if (!picked.size) { if (q.required) { say("Оберіть хоча б один варіант, будь ласка."); after(() => renderOptions(q)); clearButtons(); return; } picked.add(q.options.findIndex(x => x.none)); }
        const idx = [...picked].filter(i => i >= 0).sort((a, b) => a - b);
        clearButtons(); userMsg(idx.length ? idx.map(i => q.options[i].label).join(", ") : "Нічого з цього"); answer(idx);
      });
      w.append(done);
    }
    if (st.qi > 0) { const bk = el("button", "chip ghost", "← Назад"); bk.type = "button"; bk.addEventListener("click", () => { clearButtons(); userMsg("Назад"); goBack(); }); w.append(bk); }
    log.append(w);
  }
  function recordAnswer(q, idx) {
    const chosen = idx.map(i => q.options[i]).filter(Boolean);
    st.answers[st.qi] = { qid: q.id, question: fill(q.text), labels: chosen.map(o => o.label), options: chosen, tz: chosen.filter(o => !o.none).map(o => o.tz || o.label) };
  }
  function answer(idx) {
    recordAnswer(curQ(), idx);
    st.qi++;
    askQuestion();
  }
  function answerFree(text) {
    const q = curQ();
    st.description = (st.description ? st.description + "\n" : "") + text;
    st.answers[st.qi] = { qid: q.id, question: q.text, labels: [text], options: [], tz: [] };
    st.qi++;
    askQuestion();
  }
  function goBack() {
    if (st.qi > 0) { st.qi--; st.answers.length = st.qi; const q = curQ(); if (q && st.pre) delete st.pre[q.id]; askQuestion(); }
    else chooseType();
  }
  /* parse "До 5", "6–10", "Понад 20", "13 і більше" */
  function rangeOf(label) {
    const l = label.toLowerCase().replace(/\s/g, "");
    let m;
    if ((m = l.match(/^до(\d+)/))) return [0, +m[1]];
    if ((m = l.match(/^(\d+)[–-](\d+)/))) return [+m[1], +m[2]];
    if ((m = l.match(/(понад|більше)(\d+)/))) return [+m[2] + 1, Infinity];
    if ((m = l.match(/^(\d+)(і|и)більше/))) return [+m[1], Infinity];
    return null;
  }
  function matchOption(q, text) {
    const t = norm(text);
    if (q.multi) {
      const noneIdx = q.options.findIndex(o => o.none);
      // «все», «усе», «хочу все», «все перелічене» → обрати всі варіанти
      if (/ (все|усе|всё|всі|усі|всех|всего|all|everything|кожне|кожен|повний пакет|максимум|по максимуму|все підряд|все одразу) /.test(t) && !/ (не все|не усе|не всё|все одно|всё равно) /.test(t))
        return q.options.map((o, i) => o.none ? -1 : i).filter(i => i >= 0);
      // «нічого», «не треба» → «Нічого з цього»
      if (noneIdx >= 0 && / (нічого|ничего|не треба|не нужно|не потрібно|не надо|без цього|без этого|nothing|none|ні одного|жодного) /.test(t)) return [noneIdx];
    }
    const n = t.match(/\d+/);
    if (n) { const v = +n[0]; const i = q.options.findIndex(o => { const r = rangeOf(o.label); return r && v >= r[0] && v <= r[1]; }); if (i >= 0) return [i]; }
    const scores = q.options.map(o => {
      const lab = norm(o.label).trim();
      if (lab && t.includes(" " + lab + " ")) return 100;
      const words = lab.split(" ").filter(w => w.length > 3);
      return words.filter(w => t.includes(w.slice(0, Math.max(4, w.length - 2)))).length;
    });
    const best = Math.max(0, ...scores);
    const hits = best > 0 ? scores.map((s, i) => (q.multi ? s > 0 : s === best) ? i : -1).filter(i => i >= 0) : [];
    if (/^ (так|да|yes|ага|звісно|конечно) $/.test(t)) { const i = q.options.findIndex(o => /^так/i.test(o.label)); if (i >= 0) return [i]; }
    if (/^ (ні|нет|no|не треба|не нужно|не потрібно) $/.test(t)) { const i = q.options.findIndex(o => /^(ні|не потрібно|нічого|тільки одна|одна мова)/i.test(o.label)); if (i >= 0) return [i]; }
    if (/не знаю|хз|без понятия|порадьте/.test(t)) { const i = q.options.findIndex(o => /не знаю/i.test(o.label)); if (i >= 0) return [i]; }
    return hits.length ? (q.multi ? hits : [hits[0]]) : null;
  }

  function calc(answers, type, onlyCore) {
    const items = [];
    (type.base || []).forEach(b => items.push({ item: b.item, h: b.h.slice() }));
    let mult = 1;
    answers.forEach(a => a.options.forEach(o => {
      if (o.mult) mult *= o.mult;
      if (!o.h || (!o.h[0] && !o.h[1])) return;
      if (onlyCore && o.opt) return;
      items.push({ item: o.item || o.label, h: o.h.slice() });
    }));
    if (items.length && type.id !== "brand" && type.id !== "design") items.push({ item: "Тестування і запуск", h: [4, 10] });
    const ha = items.reduce((s, i) => s + i.h[0], 0), hb = items.reduce((s, i) => s + i.h[1], 0);
    const r10 = v => Math.round(v / 10) * 10;
    const priceMin = r10(ha * S.rateMin * mult), priceMax = r10(hb * S.rateMax * mult);
    let wMin = Math.max(1, Math.round(ha / S.hoursPerWeek)), wMax = Math.max(wMin + 1, Math.ceil(hb / S.hoursPerWeek));
    if (mult > 1) { wMin = Math.max(1, Math.round(wMin / mult)); wMax = Math.max(wMin + 1, Math.ceil(wMax / mult)); }
    const weeks = hb <= 24 ? "до 1 тижня" : wMin + "–" + wMax + " тиж.";
    return { items, ha, hb, mult, priceMin, priceMax, weeks };
  }

  function finishEstimate() {
    const type = st.type;
    st.mode = "done";
    if (type.noEstimate) {
      st.estimate = null;
      say(type.noEstimate, [{ label: "Залишити контакт", action: "send" }, { label: "Ціни", action: "faq:prices" }, { label: "Меню", action: "menu" }]);
      return;
    }
    const e = calc(st.answers, type, false);
    const core = calc(st.answers, type, true);
    if (core.priceMax < e.priceMax) e.mvp = { priceMin: core.priceMin, priceMax: core.priceMax, items: core.items };
    st.estimate = e;
    st.title = type.title;
    say("Готово! Орієнтовна вартість: **" + money(e.priceMin) + " – " + money(e.priceMax) + "**, термін " + e.weeks.replace(/\.$/, "") + ". Деталі нижче.");
    after(() => estimateCard(e));
    say("Що далі?", [
      { label: "Надіслати заявку", action: "send" },
      ...(e.mvp ? [{ label: "Як зробити дешевше?", action: "mvp" }] : []),
      { label: "Що входить у ціну?", action: "faq:included" },
      { label: "Як проходить оплата?", action: "faq:payment" },
      { label: "Змінити відповіді", action: "redo" },
      { label: "Скопіювати оцінку", action: "copy" },
      { label: "Інший проєкт", action: "estimate" }
    ]);
  }
  function estimateCard(e) {
    const c = el("div", "est");
    const h = el("div", "est-head");
    h.append(el("span", "k", "Попередня оцінка"), el("h4", null, st.type.title));
    const tot = el("div", "total"); tot.append(el("span", null, money(e.priceMin) + " – " + money(e.priceMax)), " ", el("small", null, "· " + e.ha + "–" + e.hb + " год · " + e.weeks));
    h.append(tot); c.append(h);
    const tw = el("div", "tbl"), t = document.createElement("table");
    t.innerHTML = '<thead><tr><th>Роботи</th><th class="r">Години</th><th class="r">Вартість</th></tr></thead><tbody></tbody>';
    e.items.forEach(i => { const tr = document.createElement("tr"); tr.append(el("td", null, i.item), el("td", "r", i.h[0] + "–" + i.h[1]), el("td", "r", money(i.h[0] * S.rateMin * e.mult) + " – " + money(i.h[1] * S.rateMax * e.mult))); t.tBodies[0].append(tr); });
    tw.append(t); c.append(tw);
    const body = el("div", "est-body");
    const ul = el("ul");
    ["Ставка $" + S.rateMin + "–" + S.rateMax + " за годину" + (e.mult > 1 ? ", терміново +" + Math.round((e.mult - 1) * 100) + "%" : ""),
     "Не входить: хостинг (сервер), домен і платні сервіси — оплачує клієнт"].forEach(x => ul.append(el("li", null, x)));
    body.append(ul, el("div", "warn", D.NOTE));
    c.append(body); log.append(c);
  }
  function showMvp() {
    const e = st.estimate; if (!e || !e.mvp) return answerFaq(faqById("cheaper"));
    const removed = e.items.filter(i => !e.mvp.items.some(x => x.item === i.item)).map(i => "• " + i.item);
    say("Мінімальна версія (MVP) — без додаткових функцій — коштуватиме приблизно **" + money(e.mvp.priceMin) + " – " + money(e.mvp.priceMax) + "**.\n\nЩо відкладаємо на потім:\n" + removed.join("\n") + "\n\nЇх можна додати після запуску, коли побачите, що потрібно саме вам.",
      [{ label: "Надіслати заявку", action: "send" }, { label: "Змінити відповіді", action: "redo" }, { label: "Меню", action: "menu" }]);
  }
  function estimateText() {
    const e = st.estimate; if (!e) return "";
    return "Оцінка Pixel Hata: " + st.type.title + "\n" + e.items.map(i => "• " + i.item + ": " + i.h[0] + "–" + i.h[1] + " год").join("\n") + "\nРазом: " + money(e.priceMin) + " – " + money(e.priceMax) + ", " + e.weeks + "\n" + D.NOTE;
  }
  function copyEstimate() {
    const txt = estimateText();
    const ok = () => say("Скопіював оцінку. Можете переслати її нам або колегам.", [{ label: "Надіслати заявку", action: "send" }, { label: "Меню", action: "menu" }]);
    try { navigator.clipboard.writeText(txt).then(ok, () => { copyFallback(txt); ok(); }); } catch (e) { copyFallback(txt); ok(); }
  }
  function copyFallback(text) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.append(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }

  /* ---------- forms (contact / human) ---------- */
  const validContact = v => /@/.test(v) || (v.replace(/\D/g, "").length >= 7) || /^@?[a-z0-9_]{4,}$/i.test(v.trim());
  function contactForm() {
    st.mode = "contact";
    say("Залиште, будь ласка, ім'я і контакт — ми напишемо протягом робочого дня з точною ціною і попереднім ТЗ.");
    after(() => inlineForm({
      fields: [["name", "Ім'я", "name"], ["contact", "Telegram, телефон або email", "tel"], ["comment", "Коментар (необовʼязково)", "", true]],
      submit: "Надіслати заявку",
      onSubmit: v => {
        const lead = {
          id: "L" + Date.now().toString(36), kind: "estimate", createdAt: new Date().toISOString(),
          title: st.title || (st.type && st.type.title) || "Проєкт", typeId: st.typeId || null,
          description: st.description || "", answers: (st.answers || []).map(a => ({ question: a.question, labels: a.labels, tz: a.tz })),
          estimate: st.estimate ? { items: st.estimate.items, ha: st.estimate.ha, hb: st.estimate.hb, mult: st.estimate.mult, priceMin: st.estimate.priceMin, priceMax: st.estimate.priceMax, weeks: st.estimate.weeks, mvp: st.estimate.mvp ? { priceMin: st.estimate.mvp.priceMin, priceMax: st.estimate.mvp.priceMax } : null } : null,
          contact: { name: v.name, contact: v.contact, comment: v.comment || "" },
          transcript: transcript.slice(-120)
        };
        lead.tz = LEADS.buildTz(lead);
        const saved = LEADS.save(lead);
        st.lastLead = lead;
        st.mode = "idle";
        LEADS.send(lead).then(r => {
          if (r.ok || r.offline) say("Дякую, " + v.name + "! Заявку надіслано. Ми напишемо вам протягом робочого дня.\n\nЯ вже склав попереднє ТЗ за вашими відповідями — можете глянути.", [{ label: "Показати попереднє ТЗ", action: "tz" }, { label: "Меню", action: "menu" }]);
          else if (saved) say("Заявку збережено, але зараз не вдалося відправити її команді. Щоб не чекати, напишіть нам напряму: Telegram {telegram} або Instagram {instagram}.", [{ label: "Показати попереднє ТЗ", action: "tz" }, { label: "Меню", action: "menu" }]);
          else say("Не вдалося надіслати заявку. Напишіть нам напряму: Telegram {telegram} або Instagram {instagram}.", "menu");
        });
      }
    }));
  }
  function humanForm() {
    st.mode = "human";
    say("Передам ваше питання Анастасії або Дмитру. Напишіть, що вас цікавить, і як з вами зв'язатися.");
    after(() => inlineForm({
      fields: [["name", "Ім'я", "name"], ["contact", "Telegram, телефон або email", "tel"], ["question", "Ваше питання", "", false, true]],
      submit: "Надіслати",
      onSubmit: v => {
        const lead = { id: "Q" + Date.now().toString(36), kind: "question", createdAt: new Date().toISOString(), title: "Питання від клієнта", question: v.question, contact: { name: v.name, contact: v.contact, comment: "" }, transcript: transcript.slice(-120) };
        lead.tz = "# Питання від клієнта\n\n- Клієнт: " + v.name + " · " + v.contact + "\n- Дата: " + new Date().toLocaleString("uk-UA") + "\n\n## Питання\n" + v.question;
        LEADS.save(lead);
        st.mode = "idle";
        LEADS.send(lead).then(r => {
          if (r.ok || r.offline) say("Дякую! Питання передано команді, вам відповідять протягом робочого дня ({workHours}).", "menu");
          else say("Питання збережено, але зараз не вдалося відправити його команді. Напишіть нам напряму: Telegram {telegram} або Instagram {instagram}.", "menu");
        });
      }
    }));
  }
  function inlineForm(cfg) {
    const n = ++formN;
    const f = document.createElement("form"); f.className = "lead-form"; f.noValidate = true;
    const grid = el("div", "lf-grid");
    cfg.fields.forEach(([key, label, ac, optional, area]) => {
      const row = el("div", "lf-row" + (area ? " wide" : ""));
      const lb = el("label", null, label); lb.htmlFor = "f" + n + key;
      const inp = document.createElement(area ? "textarea" : "input"); inp.id = "f" + n + key; inp.name = key; if (ac) inp.autocomplete = ac; if (area) inp.rows = 3;
      row.append(lb, inp); grid.append(row);
    });
    const act = el("div", "lf-act"); const sb = el("button", "btn hot", cfg.submit); sb.type = "submit";
    const cancel = el("button", "btn", "Скасувати"); cancel.type = "button";
    act.append(sb, cancel);
    const msg = el("p", "lf-s"); msg.setAttribute("aria-live", "polite");
    f.append(grid, act, msg);
    cancel.addEventListener("click", () => { f.remove(); userMsg("Скасувати"); showMenu(); });
    f.addEventListener("submit", ev => {
      ev.preventDefault();
      const v = {}; cfg.fields.forEach(([k]) => { v[k] = f.elements[k].value.trim(); });
      const missing = cfg.fields.filter(([k, , , opt]) => !opt && !v[k]);
      if (missing.length) { msg.className = "lf-s bad"; msg.textContent = "Заповніть: " + missing.map(m => m[1]).join(", ") + "."; return; }
      if (!validContact(v.contact)) { msg.className = "lf-s bad"; msg.textContent = "Схоже, контакт неповний. Вкажіть @нік у Telegram, телефон або email."; return; }
      f.querySelectorAll("input,textarea,button").forEach(x => x.disabled = true);
      msg.className = "lf-s"; msg.textContent = "Надіслано";
      transcript.push({ role: "user", text: "[форма] " + Object.values(v).filter(Boolean).join(" · ") });
      cfg.onSubmit(v);
    });
    log.append(f);
    setTimeout(() => { try { f.elements[cfg.fields[0][0]].focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  function showTz() {
    const lead = st.lastLead; if (!lead) return say("ТЗ зʼявиться після того, як ви надішлете заявку.", "menu");
    after(() => { const d = el("details", "tz-box"); d.open = true; d.append(el("summary", null, "Попереднє ТЗ"), el("pre", null, lead.tz)); log.append(d); });
    say("Це чернетка: на дзвінку ми її уточнимо і доповнимо.", "menu");
  }

  function markWrong() {
    if (LEARN && st.lastAsked) LEARN.logWrong(st.lastAsked, st.lastFaq);
    st.lastUnknown = st.lastAsked || null;
    say("Дякую, що підказали! Я записав це — команда навчить мене правильно відповідати. Оберіть тему нижче або напишіть людині.", D.MENU.concat([]));
  }

  /* ---------- free text ---------- */
  function onText(text) {
    if (isCmd(text, "menu")) return showMenu();
    if (st.mode === "contact" || st.mode === "human") {
      return say("Заповніть, будь ласка, форму вище — або напишіть «меню», щоб повернутись.");
    }
    if (st.mode === "estimate") {
      const q = curQ();
      if (isCmd(text, "back")) return goBack();
      if (q && q.free) return answerFree(text);
      if (q) {
        const idx = matchOption(q, text);
        if (idx) { clearButtons(); return answer(idx); }
        const f = matchFaq(text);
        if (f && f.id !== "hello" && f.id !== "thanks") { answerFaqInline(f); return; }
        if (LEARN) LEARN.logUnknown(text, "оцінка: " + q.text);
        say(q.multi ? "Не зрозумів відповідь. Натисніть потрібні варіанти і «Готово» — або напишіть словами: «все», «нічого», «фільтри і відгуки». Можна також «назад» або «меню»."
                    : "Не зрозумів відповідь. Оберіть варіант кнопкою нижче, напишіть «назад» або «меню».");
        after(() => { clearButtons(); renderOptions(q); });
        return;
      }
    }
    if (isCmd(text, "human")) return humanForm();
    const type = detectType(text);
    const fq = matchFaq(text);
    if (fq && fq.glossary && text.length <= 160) return answerFaq(fq, text);   // «що таке …» — пояснюємо, а не рахуємо
    if (text.length > 160) {
      if (type) { say("Зрозумів, вам потрібно: **" + D.TYPES.find(t => t.id === type).label + "**."); return startEstimate(type, text); }
      st.description = text;
      say("Дякую за опис! Щоб порахувати, оберіть, що з цього найближче:", D.TYPES.map(t => ({ label: t.label, action: "type:" + t.id })));
      st.mode = "pick"; return;
    }
    const f = matchFaq(text);
    if (type && (wantsBuild(text) || text.length > 50 || !f)) {
      say("Зрозумів, вам потрібно: **" + D.TYPES.find(t => t.id === type).label + "**.");
      return startEstimate(type, text.length > 25 ? text : "");
    }
    if (isCmd(text, "estimate") && !f) return chooseType();
    if (f) return answerFaq(f, text);
    if (st.mode === "pick") { if (LEARN) LEARN.logUnknown(text, "вибір типу проєкту"); say("Оберіть тип проєкту кнопкою — або «Інше / не знаю», якщо нічого не підходить."); return; }
    fallback(text);
  }
  function answerFaqInline(f) {
    say(f.text);
    say("Повернімось до оцінки:");
    after(() => { clearButtons(); const q = curQ(); say("" + q.text); after(() => renderOptions(q)); });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = input.value.trim(); if (!v) return;
    input.value = ""; size();
    clearButtons(); userMsg(v); onText(v);
  });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  function size() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; }
  input.addEventListener("input", size);

  /* open from anywhere: links with data-bot="estimate" etc. */
  document.querySelectorAll("[data-bot]").forEach(a => a.addEventListener("click", () => {
    const act = a.getAttribute("data-bot");
    setTimeout(() => { clearButtons(); run(act); }, 350);
  }));

  /* greeting */
  say("Вітаю! Я бот-помічник Pixel Hata. Порахую попередню вартість вашого проєкту або відповім на питання про роботу: ціни, терміни, оплату, хостинг.\n\nОберіть кнопку або напишіть своїми словами, наприклад: «хочу інтернет-магазин одягу». Не знаєте, що саме потрібно, — не страшно: я допоможу скласти ТЗ.", "menu");

  window.PHBot = { run, onText, _state: () => st, _match: matchFaq, _faqs: allFaqs, _type: detectType, _calc: calc };
})();

/* Pixel Hata — показ на сайті: проєкти, додані з кабінету, і відгуки клієнтів */
(function () {
  const C = window.PHContent; if (!C) return;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
  const money = n => "$" + Number(n).toLocaleString("en-US").replace(/,/g, " ");

  /* ---------- нові проєкти з кабінету ---------- */
  const box = document.getElementById("extraWorks");
  if (box) {
    box.replaceChildren(...C.projects().map(p => {
      const a = el("article", "card wcard"); a.dataset.who = (p.cats.length ? p.cats : Object.keys(C.CATS)).join(" ");
      const shot = el("div", "shot");
      if (p.image && /^data:image\/(jpeg|png|webp);base64,/.test(p.image)) { const i = el("img"); i.src = p.image; i.alt = p.title + " — головний екран"; i.loading = "lazy"; i.width = 960; i.height = 600; shot.append(i); }
      else shot.append(el("div", "ph", "[скрін " + p.title + "]"));
      if (p.price) { const s = el("a", "sale", "готова робота · від " + money(p.price)); s.href = "#ready"; shot.append(s); }
      const t = el("div", "txt");
      t.append(el("span", "tag", p.who + (p.tag ? " · " + p.tag : "")), el("h3", null, p.title));
      if (p.desc) { const d = el("p", "muted", p.desc); d.style.fontSize = "15px"; t.append(d); }
      if (p.stack) t.append(el("p", "stk", p.stack));
      const links = el("div", "wlinks");
      [[p.site, "Відкрити сайт"]].forEach(([u, label]) => {
        if (!u) return; const l = el("a", "code"); l.href = u; l.target = "_blank"; l.rel = "noopener"; l.textContent = label + " "; l.insertAdjacentHTML("beforeend", ARROW); links.append(l);
      });
      if (links.children.length) t.append(links);
      a.append(shot, t); return a;
    }));
  }

  /* ---------- відгуки ---------- */
  const list = document.getElementById("revList"), sum = document.getElementById("revSummary"), form = document.getElementById("revForm"), msg = document.getElementById("revMsg");
  function stars(n) { const s = el("div", "rs"); s.setAttribute("aria-label", n + " з 5"); s.textContent = "★".repeat(n); const off = el("span", null, "★".repeat(5 - n)); s.append(off); return s; }
  function render() {
    if (!list) return;
    const pub = C.published();
    if (!pub.length) { list.replaceChildren(el("p", "rev-empty", "Відгуків поки немає — станьте першим, хто поділиться враженнями.")); return; }
    const avg = pub.reduce((s, r) => s + r.stars, 0) / pub.length;
    if (sum) sum.textContent = "Середня оцінка " + avg.toFixed(1).replace(".", ",") + " з 5 · відгуків: " + pub.length;
    list.replaceChildren(...pub.slice(0, 12).map(r => {
      const c = el("article", "card review"); c.append(stars(r.stars), el("p", null, r.text));
      const w = el("span", "who"); w.append(el("b", null, r.name)); if (r.project) w.append(" · " + r.project);
      w.append(" · " + new Date(r.createdAt).toLocaleDateString("uk-UA")); c.append(w); return c;
    }));
  }
  if (form) form.addEventListener("submit", ev => {
    ev.preventDefault();
    if (form.elements.website.value) return;                          // пастка для спам-ботів
    const v = { name: form.elements.name.value, project: form.elements.project.value, text: form.elements.text.value, stars: (form.querySelector('input[name=stars]:checked') || {}).value };
    if (!v.name.trim() || v.text.trim().length < 5) { msg.className = "lf-s bad"; msg.textContent = "Вкажіть імʼя і напишіть кілька слів про роботу з нами."; return; }
    const r = C.addReview(v);
    if (!r) { msg.className = "lf-s bad"; msg.textContent = "Не вдалося зберегти відгук. Спробуйте ще раз."; return; }
    msg.className = "lf-s";
    msg.textContent = r.status === "published" ? "Дякуємо! Ваш відгук уже на сайті." : "Дякуємо за чесність! Ми прочитаємо відгук і звʼяжемося з вами, щоб усе виправити.";
    form.reset(); form.querySelector("#st5").checked = true; render();
  });
  render();
  window.addEventListener("storage", render);
})();

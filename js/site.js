/* ---------- portfolio filter ---------- */
(function(){
  const btns = document.querySelectorAll('[data-f]');
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.f;
    document.querySelectorAll('[data-who]').forEach(c => { c.hidden = !(f === 'all' || c.dataset.who.split(' ').includes(f)); });
  }));
})();


/* ---------- floating chat button: hide while the chat is on screen ---------- */
(function(){
  const fab = document.querySelector('.bot-fab'), sec = document.querySelector('#estimate .chat');
  if (!fab || !sec || !window.IntersectionObserver) return;
  new IntersectionObserver(es => es.forEach(e => { fab.hidden = e.isIntersecting; }), { threshold: .15 }).observe(sec);
})();

/* Прихований вхід у кабінет команди: 5 натискань на «©» у футері за 3 секунди
   або Ctrl+Shift+Y. Сам кабінет усе одно просить пошту й пароль. */
(function () {
  const go = () => { location.href = "admin.html"; };
  const mark = document.getElementById("copyMark");
  if (mark) {
    let n = 0, t = 0;
    mark.addEventListener("click", () => {
      const now = Date.now(); if (now - t > 3000) n = 0; t = now;
      if (++n >= 5) { n = 0; go(); }
    });
  }
  document.addEventListener("keydown", e => { if (e.ctrlKey && e.shiftKey && (e.key === "Y" || e.key === "y")) go(); });
})();

/* Акція −50%: смужка вгорі і вікно при першому заході (раз за сесію). Після дати акції — нічого не показуємо. */
(function () {
  const p = (window.PH_DATA && window.PH_DATA.STUDIO && window.PH_DATA.STUDIO.promo) || { until: "2027-07-31" };
  if (Date.now() > new Date(p.until + "T23:59:59").getTime()) { afterPromo(); return; }
  const bar = document.getElementById("promoBar"), m = document.getElementById("promoModal");
  if (bar) bar.hidden = false;
  if (!m) return;
  let seen = false; try { seen = sessionStorage.getItem("ph.promo.seen") === "1"; } catch (e) {}
  const close = () => { m.hidden = true; try { sessionStorage.setItem("ph.promo.seen", "1"); } catch (e) {} };
  if (!seen) setTimeout(() => { m.hidden = false; const b = document.getElementById("promoGo"); b && b.focus({ preventScroll: true }); }, 700);
  document.getElementById("promoClose").onclick = close;
  m.addEventListener("click", e => { if (e.target === m) close(); });
  document.getElementById("promoGo").addEventListener("click", close);
  document.getElementById("promoReady").addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !m.hidden) close(); });
})();

/* Після 31 липня: −50% зникає, діють постійні знижки — −45% на перше замовлення і −25% постійним клієнтам.
   Ціни на сторінках перераховуються зі звичайних (закреслених) сум. */
function afterPromo() {
  const D = (window.PH_DATA && window.PH_DATA.STUDIO && window.PH_DATA.STUDIO.discounts) || { firstOrder: 45, regular: 25 };
  const k = (100 - D.firstOrder) / 100, r5 = v => Math.round(v / 5) * 5;
  const num = t => +String(t).replace(/[^0-9]/g, "");
  const m = v => "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  document.querySelectorAll(".prow .p").forEach(el => { const s = el.querySelector("s"); if (s) el.innerHTML = "від " + m(r5(num(s.textContent) * k)) + " <s>" + s.textContent + "</s>"; });
  document.querySelectorAll(".two-price > span").forEach(sp => { const b = sp.querySelector("b"), s = sp.querySelector("s"); if (b && s) b.textContent = m(r5(num(s.textContent) * k)); });
  document.querySelectorAll("p.promo").forEach(el => { el.textContent = "−" + D.firstOrder + "% на перше замовлення"; });
  document.querySelectorAll("details.pr tr").forEach(tr => { if (/Зі знижкою/.test(tr.textContent)) { const td = tr.querySelectorAll("td"); const tot = tr.previousElementSibling && tr.previousElementSibling.querySelectorAll("th")[1]; if (td.length === 2 && tot) { td[0].textContent = "Перше замовлення −" + D.firstOrder + "%"; td[1].textContent = m(r5(num(tot.textContent) * k)); } } });
  document.querySelectorAll("a.sale").forEach(a => { const mm = a.textContent.match(/від \$([\d\s]+)/); if (mm) a.textContent = "готова робота · від " + m(r5(num(mm[1]) * 2 * k)) + " · −" + D.firstOrder + "%"; });
  document.querySelectorAll(".promo-note").forEach(el => { el.innerHTML = "🎁 <b>−" + D.firstOrder + "%</b> на перше замовлення і <b>−" + D.regular + "%</b> постійним клієнтам. Ціни нижче — для першого замовлення."; });
  document.querySelectorAll(".rules .card p").forEach(el => { el.innerHTML = el.innerHTML.replace(/До 31 липня — −50% на будь-який проєкт і готові роботи\./, "Перше замовлення — −" + D.firstOrder + "%, постійним клієнтам — −" + D.regular + "%."); });
  const bar = document.getElementById("promoBar");
  if (bar) { const sp = bar.querySelector("span"); if (sp) sp.textContent = "🎁 −" + D.firstOrder + "% на перше замовлення · −" + D.regular + "% постійним клієнтам"; bar.hidden = false; }
  const modal = document.getElementById("promoModal"); if (modal) modal.remove();
}

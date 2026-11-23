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
  if (Date.now() > new Date(p.until + "T23:59:59").getTime()) return;
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

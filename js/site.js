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

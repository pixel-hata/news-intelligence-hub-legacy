/* ---------- portfolio filter ---------- */
(function(){
  const btns = document.querySelectorAll('[data-f]');
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.f;
    document.querySelectorAll('[data-who]').forEach(c => { c.hidden = !(f === 'all' || c.dataset.who === f); });
  }));
})();


/* ---------- floating chat button: hide while the chat is on screen ---------- */
(function(){
  const fab = document.querySelector('.bot-fab'), sec = document.querySelector('#estimate .chat');
  if (!fab || !sec || !window.IntersectionObserver) return;
  new IntersectionObserver(es => es.forEach(e => { fab.hidden = e.isIntersecting; }), { threshold: .15 }).observe(sec);
})();

/* ==========================================================================
   Pixel Hata — контент, яким керує команда з кабінету (admin.html):
   • нові проєкти для портфоліо (з посиланнями і картинкою);
   • відгуки клієнтів: 3–5 зірок публікуються одразу, 1–2 — після перевірки.
   У макеті все зберігається в браузері. На справжньому сайті — на сервері.
   ========================================================================== */
window.PHContent = (function () {
  const KP = "pixelhata.projects.v1", KR = "pixelhata.reviews.v1";
  const read = k => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const id = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const safeUrl = u => { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; } };

  const CATS = { site: "Сайти", shop: "Магазини", crm: "CRM і фінанси", app: "Застосунки", auto: "Автоматизація", edu: "Навчання і AI", small: "Малі сторінки" };

  /* ---------- проєкти ---------- */
  const projects = () => read(KP);
  function addProject(p) {
    const arr = projects();
    const item = {
      id: id("p"), createdAt: new Date().toISOString(),
      title: String(p.title || "").trim().slice(0, 80), who: String(p.who || "Анастасія").slice(0, 40),
      tag: String(p.tag || "").trim().slice(0, 60), cats: (p.cats || []).filter(c => c in CATS),
      desc: String(p.desc || "").trim().slice(0, 400), stack: String(p.stack || "").trim().slice(0, 120),
      site: safeUrl(p.site), code: safeUrl(p.code), image: String(p.image || "").slice(0, 900000),
      price: Number(p.price) > 0 ? Math.round(Number(p.price)) : null
    };
    if (!item.title) return null;
    arr.unshift(item);
    return write(KP, arr.slice(0, 60)) ? item : null;
  }
  const removeProject = pid => write(KP, projects().filter(p => p.id !== pid));

  /* ---------- відгуки ---------- */
  const reviews = () => read(KR);
  function addReview(r) {
    const stars = Math.max(1, Math.min(5, Math.round(Number(r.stars) || 0)));
    const item = { id: id("r"), createdAt: new Date().toISOString(), name: String(r.name || "").trim().slice(0, 60), text: String(r.text || "").trim().slice(0, 800), project: String(r.project || "").trim().slice(0, 80), stars, status: stars >= 3 ? "published" : "pending" };
    if (!item.name || !item.text) return null;
    const arr = reviews(); arr.unshift(item);
    return write(KR, arr.slice(0, 500)) ? item : null;
  }
  const setReview = (rid, status) => write(KR, reviews().map(r => r.id === rid ? Object.assign({}, r, { status }) : r));
  const removeReview = rid => write(KR, reviews().filter(r => r.id !== rid));
  const published = () => reviews().filter(r => r.status === "published");

  /* картинка проєкту: зменшуємо до 960×600 і стискаємо, щоб влізла в браузер */
  function shrinkImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("read"));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error("image"));
        img.onload = () => {
          const W = 960, H = 600, c = document.createElement("canvas"); c.width = W; c.height = H;
          const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
          const g = c.getContext("2d"); g.fillStyle = "#12131D"; g.fillRect(0, 0, W, H);
          g.drawImage(img, (W - w) / 2, 0, w, h);
          res(c.toDataURL("image/jpeg", 0.78));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  const exportJson = () => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: projects(), reviews: reviews() }, null, 2);

  return { CATS, projects, addProject, removeProject, reviews, published, addReview, setReview, removeReview, shrinkImage, exportJson, safeUrl };
})();

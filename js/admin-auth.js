/* Кабінет команди: вхід за поштою і паролем через Supabase Auth.
   Поки користувач не увійшов, кабінет схований. Сесію Supabase зберігає сам. */
(function () {
  const cfg = window.PH_AUTH || {};
  const $ = id => document.getElementById(id);
  const gate = $("gate"), app = document.querySelector(".admin");
  const form = $("gateForm"), msg = $("gateMsg"), who = $("whoami"), out = $("logoutBtn");
  const allowed = (cfg.ADMIN_EMAILS || []).map(e => String(e).trim().toLowerCase()).filter(Boolean);

  function show(session) {
    const email = session && session.user && session.user.email ? session.user.email.toLowerCase() : "";
    const ok = !!email && (!allowed.length || allowed.includes(email));
    gate.hidden = ok; app.hidden = !ok;
    if (ok && who) who.textContent = email;
    const had = !!window.PH_AUTH_TOKEN;
    window.PH_AUTH_TOKEN = ok ? session.access_token : null;
    window.PH_AUTH_EMAIL = ok ? email : null;
    if (ok && !had) { try { window.dispatchEvent(new Event("ph:signedin")); } catch (e) {} }
    return ok;
  }
  function say(t, bad) { msg.textContent = t; msg.className = "lf-s" + (bad ? " bad" : ""); }

  app.hidden = true; gate.hidden = false;
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    say("Вхід ще не налаштовано: впишіть публічний ключ Supabase (anon) у js/auth-config.js.", true);
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  sb.auth.getSession().then(({ data }) => show(data.session));
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { $("newPassRow").hidden = false; say("Введіть новий пароль і натисніть «Зберегти пароль»."); return; }
    show(session);
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("gEmail").value.trim(), password = $("gPass").value;
    if (!email || !password) return say("Введіть пошту і пароль.", true);
    say("Перевіряю…");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return say(error.message === "Invalid login credentials" ? "Неправильна пошта або пароль." : "Не вдалося увійти: " + error.message, true);
    if (!show(data.session)) { await sb.auth.signOut(); say("Ця пошта не має доступу до кабінету.", true); return; }
    say("");
    form.reset();
  });

  $("forgotBtn").addEventListener("click", async () => {
    const email = $("gEmail").value.trim();
    if (!email) return say("Введіть пошту, і ми надішлемо посилання для нового пароля.", true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
    say(error ? "Не вдалося надіслати лист: " + error.message : "Якщо така пошта є, на неї прийде лист із посиланням.", !!error);
  });
  $("savePassBtn").addEventListener("click", async () => {
    const p = $("gNewPass").value;
    if (p.length < 8) return say("Пароль має бути щонайменше 8 символів.", true);
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) return say("Не вдалося змінити пароль: " + error.message, true);
    $("newPassRow").hidden = true; say("Пароль змінено.");
    sb.auth.getSession().then(({ data }) => show(data.session));
  });
  out && out.addEventListener("click", async () => { await sb.auth.signOut(); show(null); say("Ви вийшли з кабінету."); });
})();

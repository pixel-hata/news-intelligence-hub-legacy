/* Вхід у кабінет команди через Supabase (пошта + пароль).
   1) SUPABASE_URL — адреса вашого проєкту Supabase.
   2) SUPABASE_ANON_KEY — публічний ключ «anon public» (Supabase → Project Settings → API).
      Він не секретний: його можна тримати в коді сайту. Секретний service_role сюди НЕ вставляти.
   3) ADMIN_EMAILS — пошти, яким дозволено заходити в кабінет (порожній список = усі користувачі проєкту). */
window.PH_AUTH = {
  SUPABASE_URL: "https://rheeoeeewtucppooyvcb.supabase.co",
  SUPABASE_ANON_KEY: "",
  ADMIN_EMAILS: ["skil.loraa12@gmail.com", "dz@lmlift.com"]
};

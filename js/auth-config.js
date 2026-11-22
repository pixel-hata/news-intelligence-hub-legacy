/* Вхід у кабінет команди через Supabase (пошта + пароль).
   1) SUPABASE_URL — адреса вашого проєкту Supabase.
   2) SUPABASE_ANON_KEY — публічний ключ «anon public» (Supabase → Project Settings → API).
      Він не секретний: його можна тримати в коді сайту. Секретний service_role сюди НЕ вставляти.
   3) ADMIN_EMAILS — пошти, яким дозволено заходити в кабінет (порожній список = усі користувачі проєкту). */
window.PH_AUTH = {
  SUPABASE_URL: "https://rheeoeeewtucppooyvcb.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZWVvZWVld3R1Y3Bwb295dmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzY4NjAsImV4cCI6MjEwNDk1Mjg2MH0.T71YSk30WySY1IgBWByN85mh9wZGe4VbOighXkSd3Eo",
  ADMIN_EMAILS: ["skil.loraa12@gmail.com", "dz@lmlift.com"]
};

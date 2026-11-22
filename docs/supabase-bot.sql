-- Спільна памʼять бота Pixel Hata в Supabase.
-- Виконайте один раз: Supabase → SQL Editor → New query → вставте все → Run.
-- Пошта команди: skil.loraa12@gmail.com (замініть, якщо зміните вхід у кабінет).

-- 1) Питання, які бот не зрозумів (пишуть усі відвідувачі, читає й видаляє лише команда)
create table if not exists public.bot_unknown (
  id bigint generated always as identity primary key,
  n text not null check (char_length(n) between 2 and 300),
  text text not null check (char_length(text) <= 400),
  kind text not null check (kind in ('unknown', 'wrong')),
  ctx text check (char_length(ctx) <= 200),
  faq_id text check (char_length(faq_id) <= 60),
  page text check (char_length(page) <= 60),
  created_at timestamptz not null default now()
);
alter table public.bot_unknown enable row level security;
drop policy if exists "visitors add unknown questions" on public.bot_unknown;
create policy "visitors add unknown questions" on public.bot_unknown
  for insert to anon, authenticated with check (true);
drop policy if exists "team reads unknown questions" on public.bot_unknown;
create policy "team reads unknown questions" on public.bot_unknown
  for select to authenticated using ((auth.jwt() ->> 'email') = 'skil.loraa12@gmail.com');
drop policy if exists "team deletes unknown questions" on public.bot_unknown;
create policy "team deletes unknown questions" on public.bot_unknown
  for delete to authenticated using ((auth.jwt() ->> 'email') = 'skil.loraa12@gmail.com');

-- 2) Знання, яких навчила команда (читають усі відвідувачі, пише лише команда)
create table if not exists public.bot_knowledge (
  id int primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.bot_knowledge enable row level security;
drop policy if exists "everyone reads bot knowledge" on public.bot_knowledge;
create policy "everyone reads bot knowledge" on public.bot_knowledge
  for select to anon, authenticated using (true);
drop policy if exists "team writes bot knowledge" on public.bot_knowledge;
create policy "team writes bot knowledge" on public.bot_knowledge
  for insert to authenticated with check ((auth.jwt() ->> 'email') = 'skil.loraa12@gmail.com');
drop policy if exists "team updates bot knowledge" on public.bot_knowledge;
create policy "team updates bot knowledge" on public.bot_knowledge
  for update to authenticated using ((auth.jwt() ->> 'email') = 'skil.loraa12@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'skil.loraa12@gmail.com');

grant insert on public.bot_unknown to anon, authenticated;
grant select, delete on public.bot_unknown to authenticated;
grant select on public.bot_knowledge to anon, authenticated;
grant insert, update on public.bot_knowledge to authenticated;

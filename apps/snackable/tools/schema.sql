-- Created by Claude (claude-opus-5-5)
-- Date: 2026-10-07
--
-- Snackable shared data schema (plan 0002). Paste once into the Supabase SQL editor,
-- then switch on Anonymous sign-ins under Authentication settings.

create table games (
  id text primary key,
  source text not null,
  title text not null,
  author text not null,
  embed_url text not null,
  page_url text not null,
  cover_image text not null default '',
  width int not null default 0,
  height int not null default 0,
  status text check (status in ('keep', 'hidden')),
  added_at timestamptz not null default now()
);

create table reports (
  game_id text not null references games (id) on delete cascade,
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  orientation text not null check (orientation in ('portrait', 'landscape')),
  created_at timestamptz not null default now(),
  primary key (game_id, player_id, orientation)
);

create table likes (
  game_id text not null references games (id) on delete cascade,
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

alter table games enable row level security;
alter table reports enable row level security;
alter table likes enable row level security;

-- Explicit Data API access; RLS policies below narrow it to the right rows.
grant select on games to anon, authenticated;
grant select, insert, delete on reports, likes to authenticated;

create policy "anyone reads games" on games for select using (true);

create policy "read own reports" on reports for select to authenticated using (player_id = auth.uid());
create policy "add own reports" on reports for insert to authenticated with check (player_id = auth.uid());
create policy "remove own reports" on reports for delete to authenticated using (player_id = auth.uid());
create policy "read own likes" on likes for select to authenticated using (player_id = auth.uid());
create policy "add own likes" on likes for insert to authenticated with check (player_id = auth.uid());
create policy "remove own likes" on likes for delete to authenticated using (player_id = auth.uid());

-- Runs as its owner, so it counts every player's rows while exposing only totals.
create view game_stats with (security_invoker = false) as
select g.id as game_id,
  (select count(*) from reports r where r.game_id = g.id and r.orientation = 'portrait') as reports_portrait,
  (select count(*) from reports r where r.game_id = g.id and r.orientation = 'landscape') as reports_landscape,
  (select count(*) from likes l where l.game_id = g.id) as likes
from games g;
grant select on game_stats to anon, authenticated;

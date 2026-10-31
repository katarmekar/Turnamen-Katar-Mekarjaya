-- Event pertandingan: gol, kartu kuning, kartu merah
do $$ begin
  create type public.match_event_type as enum ('goal', 'yellow_card', 'red_card');
exception when duplicate_object then null;
end $$;

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  type public.match_event_type not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_id_type_idx
  on public.match_events (match_id, type);
create index if not exists match_events_player_id_idx
  on public.match_events (player_id);

alter table public.match_events enable row level security;

drop policy if exists "match_events_select" on public.match_events;
create policy "match_events_select"
  on public.match_events for select
  using (true);

drop policy if exists "match_events_admin_all" on public.match_events;
create policy "match_events_admin_all"
  on public.match_events for all
  using (public.is_admin())
  with check (public.is_admin());

-- Fase grup sistem liga: pengaturan turnamen + indeks grup di slot/match
alter table public.tournaments
  add column if not exists group_count smallint,
  add column if not exists max_teams_per_group smallint,
  add column if not exists qualify_per_group smallint;

alter table public.bracket_slots
  add column if not exists group_index smallint;

alter table public.matches
  add column if not exists group_index smallint;

create index if not exists bracket_slots_tournament_id_group_index_idx
  on public.bracket_slots (tournament_id, group_index);

create index if not exists matches_tournament_id_group_index_idx
  on public.matches (tournament_id, group_index);

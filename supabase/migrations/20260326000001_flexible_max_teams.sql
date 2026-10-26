-- Kapasitas turnamen fleksibel (2–64), bukan hanya 8/16/32.
-- Ukuran bagan tetap power-of-2 (termasuk 2/4 untuk KO setelah grup, dan 64).

alter table public.tournaments
  drop constraint if exists tournaments_max_teams_check;

alter table public.tournaments
  add constraint tournaments_max_teams_check
  check (max_teams between 2 and 64);

alter table public.tournaments
  drop constraint if exists tournaments_bracket_size_check;

alter table public.tournaments
  add constraint tournaments_bracket_size_check
  check (
    bracket_size is null
    or bracket_size in (2, 4, 8, 16, 32, 64)
  );

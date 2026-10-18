-- Digantikan oleh 20260321000002_tournament_rules_items.sql
-- (peraturan sebagai item teks CRUD, bukan PDF/markdown tunggal)

alter table public.tournaments
  add column if not exists rules_version integer not null default 1;

alter table public.teams
  add column if not exists rules_accepted_version integer,
  add column if not exists rules_accepted_at timestamptz;

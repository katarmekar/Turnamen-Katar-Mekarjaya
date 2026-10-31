-- Poin klasemen liga per turnamen (default: menang 2, seri 1, kalah 0)
alter table public.tournaments
  add column if not exists points_win smallint not null default 2,
  add column if not exists points_draw smallint not null default 1,
  add column if not exists points_loss smallint not null default 0;

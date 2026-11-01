-- Harga denda kartu di turnamen + deposit per tim
alter table public.tournaments
  add column if not exists yellow_card_fine numeric(12, 2) not null default 0,
  add column if not exists red_card_fine numeric(12, 2) not null default 0,
  add column if not exists default_deposit numeric(12, 2) not null default 0;

alter table public.teams
  add column if not exists deposit_amount numeric(12, 2) not null default 0;

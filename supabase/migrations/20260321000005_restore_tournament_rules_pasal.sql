-- Kembalikan model multi-pasal (sebelum dokumen tunggal)

create table if not exists public.tournament_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  pasal_number smallint not null,
  title text not null,
  description text not null default '',
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tournament_rules_tournament_id_pasal_number_key
  on public.tournament_rules (tournament_id, pasal_number);

create index if not exists tournament_rules_tournament_id_pasal_number_idx
  on public.tournament_rules (tournament_id, pasal_number);

drop trigger if exists tournament_rules_updated_at on public.tournament_rules;
create trigger tournament_rules_updated_at
  before update on public.tournament_rules
  for each row execute function public.set_updated_at();

-- Migrasi dari rules_body (dokumen tunggal) bila tabel pasal kosong
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournaments' and column_name = 'rules_body'
  ) then
    insert into public.tournament_rules (tournament_id, pasal_number, title, description, points)
    select
      t.id,
      1,
      coalesce(nullif(btrim(t.rules_title), ''), 'Peraturan Turnamen'),
      t.rules_body,
      '[]'::jsonb
    from public.tournaments t
    where btrim(coalesce(t.rules_body, '')) <> ''
      and not exists (
        select 1 from public.tournament_rules r where r.tournament_id = t.id
      );
  end if;
end $$;

alter table public.tournaments
  drop column if exists rules_title,
  drop column if exists rules_body;

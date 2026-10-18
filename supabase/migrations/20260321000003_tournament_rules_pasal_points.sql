-- Pasal: nomor editable + deskripsi + poin-poin (JSON)

-- Migrasi dari sort_order/body jika masih ada
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament_rules' and column_name = 'sort_order'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament_rules' and column_name = 'pasal_number'
  ) then
    alter table public.tournament_rules
      add column pasal_number smallint;
    update public.tournament_rules set pasal_number = sort_order + 1;
    alter table public.tournament_rules
      alter column pasal_number set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament_rules' and column_name = 'body'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament_rules' and column_name = 'description'
  ) then
    alter table public.tournament_rules rename column body to description;
  end if;
end $$;

alter table public.tournament_rules
  add column if not exists pasal_number smallint,
  add column if not exists description text not null default '',
  add column if not exists points jsonb not null default '[]'::jsonb;

-- Isi pasal_number dari sort_order bila masih null
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament_rules' and column_name = 'sort_order'
  ) then
    update public.tournament_rules
    set pasal_number = coalesce(pasal_number, sort_order + 1)
    where pasal_number is null;
  end if;
end $$;

update public.tournament_rules
set pasal_number = 1
where pasal_number is null;

alter table public.tournament_rules
  alter column pasal_number set not null;

alter table public.tournament_rules
  drop column if exists sort_order,
  drop column if exists body;

drop index if exists tournament_rules_tournament_id_sort_order_idx;

create unique index if not exists tournament_rules_tournament_id_pasal_number_key
  on public.tournament_rules (tournament_id, pasal_number);

create index if not exists tournament_rules_tournament_id_pasal_number_idx
  on public.tournament_rules (tournament_id, pasal_number);

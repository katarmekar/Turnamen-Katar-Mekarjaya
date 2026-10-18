-- Pastikan struktur pasal_number / description / points siap untuk Prisma

-- Jika masih pakai body/sort_order, transform dulu
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tournament_rules' and column_name='body'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tournament_rules' and column_name='description'
  ) then
    alter table public.tournament_rules rename column body to description;
  end if;
end $$;

alter table public.tournament_rules
  add column if not exists description text,
  add column if not exists points jsonb not null default '[]'::jsonb,
  add column if not exists pasal_number smallint;

update public.tournament_rules
set description = coalesce(description, '')
where description is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tournament_rules' and column_name='sort_order'
  ) then
    update public.tournament_rules
    set pasal_number = coalesce(pasal_number, sort_order + 1);
  end if;
end $$;

-- Fallback nomor pasal berurutan per turnamen
with numbered as (
  select
    id,
    row_number() over (partition by tournament_id order by created_at) as rn
  from public.tournament_rules
  where pasal_number is null
)
update public.tournament_rules t
set pasal_number = n.rn
from numbered n
where t.id = n.id;

update public.tournament_rules set pasal_number = 1 where pasal_number is null;

alter table public.tournament_rules
  alter column pasal_number set not null,
  alter column description set not null,
  alter column description set default '';

alter table public.tournament_rules
  drop column if exists sort_order,
  drop column if exists body;

drop index if exists tournament_rules_tournament_id_sort_order_idx;

create unique index if not exists tournament_rules_tournament_id_pasal_number_key
  on public.tournament_rules (tournament_id, pasal_number);

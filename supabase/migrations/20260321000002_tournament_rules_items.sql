-- Peraturan sebagai item teks (CRUD), ganti konten PDF/markdown tunggal

create table if not exists public.tournament_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournament_rules_tournament_id_sort_order_idx
  on public.tournament_rules (tournament_id, sort_order);

drop trigger if exists tournament_rules_updated_at on public.tournament_rules;
create trigger tournament_rules_updated_at
  before update on public.tournament_rules
  for each row execute function public.set_updated_at();

alter table public.tournaments
  drop column if exists rules_content,
  drop column if exists rules_pdf_path;

-- Pastikan rules_version ada
alter table public.tournaments
  add column if not exists rules_version integer not null default 1;

-- Kebijakan hapus turnamen:
-- - Semua baris terkait turnamen ikut hilang (ON DELETE CASCADE dari Prisma).
-- - Akun user (auth.users + public.profiles) TIDAK ikut terhapus.
-- - File Storage (folder = team_id) dibersihkan lewat trigger di bawah + app purge.

-- Pastikan FK turnamen → anak memakai CASCADE (idempotent jika sudah dari Prisma).
do $$
declare
  r record;
begin
  for r in
    select
      c.conname,
      rel.relname as table_name,
      pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%REFERENCES public.tournaments%'
  loop
    if r.def not like '%ON DELETE CASCADE%' then
      execute format(
        'alter table public.%I drop constraint %I',
        r.table_name,
        r.conname
      );
      -- Nama kolom tournament_id konsisten di semua tabel anak
      execute format(
        'alter table public.%I add constraint %I foreign key (tournament_id) references public.tournaments(id) on delete cascade',
        r.table_name,
        r.conname
      );
    end if;
  end loop;
end $$;

-- Bersihkan objek Storage saat tim dihapus (cascade dari turnamen).
-- Path konvensi: {team_id}/... di bucket payment-proofs | player-docs | team-logos.
create or replace function public.cleanup_team_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id in ('payment-proofs', 'player-docs', 'team-logos')
    and (storage.foldername(name))[1] = old.id::text;
  return old;
end;
$$;

drop trigger if exists teams_cleanup_storage on public.teams;
create trigger teams_cleanup_storage
  before delete on public.teams
  for each row
  execute function public.cleanup_team_storage();

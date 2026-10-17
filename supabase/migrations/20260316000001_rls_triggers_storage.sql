-- Pelengkap Prisma: trigger Auth, helper admin, RLS, Storage buckets
-- Jalankan di Supabase SQL Editor SETELAH `npx prisma db push`
-- (tabel/enum sudah dibuat Prisma)

-- ---------------------------------------------------------------------------
-- updated_at (Prisma @updatedAt juga mengisi di app; trigger sebagai backup)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists tournaments_updated_at on public.tournaments;
create trigger tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists players_updated_at on public.players;
create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'captain')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin helper
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.player_document_count(p_player_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.player_documents
  where player_id = p_player_id;
$$;

-- ---------------------------------------------------------------------------
-- Constraints tambahan (Prisma tidak selalu cover check)
-- ---------------------------------------------------------------------------

alter table public.tournaments
  drop constraint if exists tournaments_max_teams_check;
alter table public.tournaments
  add constraint tournaments_max_teams_check
  check (max_teams in (8, 16, 32));

alter table public.tournaments
  drop constraint if exists tournaments_bracket_size_check;
alter table public.tournaments
  add constraint tournaments_bracket_size_check
  check (bracket_size is null or bracket_size in (8, 16, 32));

alter table public.tournaments
  drop constraint if exists tournaments_min_max_players;
alter table public.tournaments
  add constraint tournaments_min_max_players
  check (min_players_per_team <= max_players_per_team);

alter table public.bracket_slots
  drop constraint if exists bracket_slots_side_check;
alter table public.bracket_slots
  add constraint bracket_slots_side_check
  check (side in ('left', 'right'));

alter table public.matches
  drop constraint if exists matches_distinct_slots;
alter table public.matches
  add constraint matches_distinct_slots
  check (slot_a_id <> slot_b_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.payments enable row level security;
alter table public.players enable row level security;
alter table public.player_documents enable row level security;
alter table public.bracket_slots enable row level security;
alter table public.matches enable row level security;

-- Drop policies if re-run
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','tournaments','teams','payments','players',
        'player_documents','bracket_slots','matches'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin());

create policy "tournaments_select_public"
  on public.tournaments for select
  using (status <> 'draft' or public.is_admin());

create policy "tournaments_admin_insert"
  on public.tournaments for insert
  with check (public.is_admin());

create policy "tournaments_admin_update"
  on public.tournaments for update
  using (public.is_admin());

create policy "tournaments_admin_delete"
  on public.tournaments for delete
  using (public.is_admin());

create policy "teams_select_authenticated"
  on public.teams for select
  to authenticated
  using (true);

create policy "teams_select_public_confirmed"
  on public.teams for select
  to anon
  using (status = 'confirmed');

create policy "teams_insert_own"
  on public.teams for insert
  to authenticated
  with check (
    captain_id = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status = 'open'
    )
  );

create policy "teams_update_own_or_admin"
  on public.teams for update
  using (captain_id = auth.uid() or public.is_admin());

create policy "payments_select_own_or_admin"
  on public.payments for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams tm
      where tm.id = team_id and tm.captain_id = auth.uid()
    )
  );

create policy "payments_insert_own_captain"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.teams tm
      where tm.id = team_id
        and tm.captain_id = auth.uid()
        and tm.status in ('pending_payment', 'rejected', 'awaiting_confirm')
    )
  );

create policy "payments_admin_update"
  on public.payments for update
  using (public.is_admin());

create policy "players_select_own_or_admin"
  on public.players for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams tm
      where tm.id = team_id and tm.captain_id = auth.uid()
    )
  );

create policy "players_write_own_confirmed"
  on public.players for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.teams tm
      where tm.id = team_id
        and tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
    )
  );

create policy "players_update_own_confirmed"
  on public.players for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams tm
      where tm.id = team_id
        and tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
    )
  );

create policy "players_delete_own_confirmed"
  on public.players for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams tm
      where tm.id = team_id
        and tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
    )
  );

create policy "player_docs_select_own_or_admin"
  on public.player_documents for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.players p
      join public.teams tm on tm.id = p.team_id
      where p.id = player_id and tm.captain_id = auth.uid()
    )
  );

create policy "player_docs_write_own"
  on public.player_documents for insert
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.players p
      join public.teams tm on tm.id = p.team_id
      where p.id = player_id
        and tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
    )
  );

create policy "player_docs_update_own"
  on public.player_documents for update
  using (
    public.is_admin()
    or exists (
      select 1
      from public.players p
      join public.teams tm on tm.id = p.team_id
      where p.id = player_id
        and tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
    )
  );

create policy "player_docs_delete_own"
  on public.player_documents for delete
  using (
    public.is_admin()
    or exists (
      select 1
      from public.players p
      join public.teams tm on tm.id = p.team_id
      where p.id = player_id and tm.captain_id = auth.uid()
    )
  );

create policy "bracket_slots_select"
  on public.bracket_slots for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status <> 'draft'
    )
  );

create policy "bracket_slots_admin_all"
  on public.bracket_slots for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "matches_select"
  on public.matches for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status <> 'draft'
    )
  );

create policy "matches_admin_all"
  on public.matches for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('payment-proofs', 'payment-proofs', false),
  ('player-docs', 'player-docs', false),
  ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- storage policies (drop + recreate aman)
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like '%payment_proofs%'
         or policyname like '%player_docs_storage%'
         or policyname like '%team_logos%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "payment_proofs_select_own_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "payment_proofs_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.teams tm
      where tm.captain_id = auth.uid()
        and (storage.foldername(name))[1] = tm.id::text
    )
  );

create policy "payment_proofs_update_own"
  on storage.objects for update
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.teams tm
      where tm.captain_id = auth.uid()
        and (storage.foldername(name))[1] = tm.id::text
    )
  )
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.teams tm
      where tm.captain_id = auth.uid()
        and (storage.foldername(name))[1] = tm.id::text
    )
  );

create policy "payment_proofs_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'payment-proofs' and public.is_admin());

create policy "player_docs_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'player-docs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "player_docs_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'player-docs'
    and exists (
      select 1 from public.teams tm
      where tm.captain_id = auth.uid()
        and tm.status = 'confirmed'
        and (storage.foldername(name))[1] = tm.id::text
    )
  );

create policy "player_docs_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'player-docs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "player_docs_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'player-docs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "team_logos_select_public"
  on storage.objects for select
  using (bucket_id = 'team-logos');

create policy "team_logos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "team_logos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

create policy "team_logos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.teams tm
        where tm.captain_id = auth.uid()
          and (storage.foldername(name))[1] = tm.id::text
      )
    )
  );

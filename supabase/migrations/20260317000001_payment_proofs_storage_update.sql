-- Fix: upload bukti transfer gagal RLS (upsert / policy update belum ada)
-- Pastikan bucket ada
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Recreate policy insert + update untuk kapten
drop policy if exists "payment_proofs_insert_own" on storage.objects;
drop policy if exists "payment_proofs_update_own" on storage.objects;
drop policy if exists "payment_proofs_select_own_or_admin" on storage.objects;
drop policy if exists "payment_proofs_admin_delete" on storage.objects;

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
  to authenticated
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
  to authenticated
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

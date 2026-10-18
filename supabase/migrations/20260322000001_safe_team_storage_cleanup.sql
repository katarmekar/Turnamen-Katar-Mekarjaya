-- Trigger hapus Storage tidak boleh menggagalkan DELETE tim / turnamen.
create or replace function public.cleanup_team_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  begin
    delete from storage.objects
    where bucket_id in ('payment-proofs', 'player-docs', 'team-logos')
      and (
        name like old.id::text || '/%'
        or (storage.foldername(name))[1] = old.id::text
      );
  exception
    when others then
      raise warning 'cleanup_team_storage(%) gagal: %', old.id, sqlerrm;
  end;
  return old;
end;
$$;

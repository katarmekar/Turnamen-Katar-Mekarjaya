-- Satu dokumen peraturan per turnamen (bukan banyak baris pasal)

alter table public.tournaments
  add column if not exists rules_title text not null default 'Peraturan Turnamen',
  add column if not exists rules_body text not null default '';

-- Gabungkan pasal lama (jika tabel masih ada) ke rules_body
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tournament_rules'
  ) then
    update public.tournaments t
    set rules_body = coalesce(agg.body, '')
    from (
      select
        tournament_id,
        string_agg(
          '<p style="text-align:left"><strong>Pasal '
            || pasal_number
            || '. '
            || replace(replace(title, '&', '&amp;'), '<', '&lt;')
            || '</strong></p>'
            || coalesce(description, ''),
          ''
          order by pasal_number asc, created_at asc
        ) as body
      from public.tournament_rules
      group by tournament_id
    ) agg
    where agg.tournament_id = t.id
      and (t.rules_body is null or btrim(t.rules_body) = '');
  end if;
end $$;

-- Tabel pasal terpisah tidak dipakai lagi (dokumen tunggal)
drop table if exists public.tournament_rules;

-- Foto pemain (opsional)
alter table public.players
  add column if not exists photo_path text;

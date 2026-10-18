-- Baris meta header peraturan (bisa diedit; kosong = otomatis)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS rules_header_meta text NOT NULL DEFAULT '';

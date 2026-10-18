-- Header dokumen peraturan (bisa diedit admin)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS rules_header_eyebrow text NOT NULL DEFAULT 'Dokumen resmi',
  ADD COLUMN IF NOT EXISTS rules_header_title text NOT NULL DEFAULT 'Peraturan Turnamen',
  ADD COLUMN IF NOT EXISTS rules_header_subtitle text NOT NULL DEFAULT '';

UPDATE public.tournaments
SET rules_header_subtitle =
  E'PERATURAN & TATA TERTIB TURNAMEN MINISOCCER\nKategori: Tingkat SD.'
WHERE rules_header_subtitle = '';

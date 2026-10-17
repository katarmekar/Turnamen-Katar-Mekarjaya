-- Izinkan side huruf grup (A–Z) untuk fase liga, selain left/right untuk knockout
alter table public.bracket_slots
  drop constraint if exists bracket_slots_side_check;

alter table public.bracket_slots
  add constraint bracket_slots_side_check
  check (
    side in ('left', 'right')
    or side ~ '^[A-Z]$'
  );

-- Promote user menjadi admin (ganti email)
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@contoh.com'
);

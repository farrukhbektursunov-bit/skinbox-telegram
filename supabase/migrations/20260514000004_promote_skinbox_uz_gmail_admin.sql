-- Admin panel: skinbox.uz@gmail.com → profiles.role = 'admin'
-- Foydalanuvchi auth.users da bo‘lishi kerak (ilova orqali ro‘yxatdan o‘tgan yoki Dashboard dan qo‘shilgan).
-- Agar email topilmasa, hech narsa o‘zgarmaydi (xato bermaydi).

insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ),
  'admin'
from auth.users u
where lower(trim(u.email)) = lower(trim('skinbox.uz@gmail.com'))
on conflict (id) do update
set
  role = 'admin',
  updated_at = now();

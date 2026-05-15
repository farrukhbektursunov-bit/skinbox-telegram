-- =============================================
-- Avatars bucket: yaratish + RLS siyosatlari
-- Foydalanuvchi `EditProfile` sahifasida o'z avatarini saqlaganda
-- xato bermasligi uchun storage.objects ustida policy lar zarur.
-- =============================================

-- 1) Bucket: avatars (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) RLS policy lar — `storage.objects`
-- Schema da RLS allaqachon yoqilgan, faqat policy larni qo'shamiz.

-- Eski (mos kelmaydigan) policy lar — idempotent qilish uchun olib tashlaymiz
drop policy if exists "Avatars public read"          on storage.objects;
drop policy if exists "Avatars owner insert"         on storage.objects;
drop policy if exists "Avatars owner update"         on storage.objects;
drop policy if exists "Avatars owner delete"         on storage.objects;

-- Hammaga o'qishga ruxsat (bucket public, lekin RLS ham talab qiladi)
create policy "Avatars public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Foydalanuvchi faqat o'z papkasiga yuklay oladi:
--   path: `<auth.uid()>/...` ko'rinishida bo'lishi shart.
create policy "Avatars owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- O'z faylini yangilaydi (upsert = true uchun zarur)
create policy "Avatars owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- O'z faylini o'chiradi
create policy "Avatars owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

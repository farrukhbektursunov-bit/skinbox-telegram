-- =============================================
-- Do'kon nomi (shop_name) va telefoni (shop_phone) storefront
-- header / login / profil sahifalarida foydalanuvchi tizimga
-- kirmasidan oldin ham ko'rinishi kerak. Shu sabab `app_settings`
-- jadvalini anon (autentifikatsiya qilinmagan) foydalanuvchilarga
-- ham o'qishga ruxsat beramiz.
--
-- Yozish huquqi avvalgidek FAQAT adminda (`public.is_admin()`).
-- Jadvalda sir bo'lishi mumkin bo'lgan kalitlar saqlanmaydi —
-- barchasi do'kon umumiy konfiguratsiyasi (shipping narxi,
-- bepul yetkazib berish chegarasi va h.k.).
-- =============================================

-- 1) Eski "authenticated" cheklovini olib tashlab, hammaga o'qishga
--    ruxsat beruvchi yangi policy bilan almashtiramiz.
drop policy if exists "App settings readable" on public.app_settings;
create policy "App settings readable to all"
  on public.app_settings for select
  using (true);

-- 2) Standart do'kon nomi (avvalgi hardcoded qiymat) — agar yo'q bo'lsa qo'shamiz.
insert into public.app_settings (key, value)
values
  ('shop_name',  to_jsonb('SkinBox'::text)),
  ('shop_phone', to_jsonb(''::text))
on conflict (key) do nothing;

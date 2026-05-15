-- =============================================
-- Sharhlarning (reviews) uzunligini server tomonida cheklash
--   Mijoz tomonida ham (textarea maxLength + slice) cheklov bor, lekin
--   defense-in-depth uchun DB darajasida ham hard cap qo'yamiz.
--   Maksimal uzunlik: 500 belgi (mahsulot sharhi uchun yetarli).
-- =============================================

-- Eski yozuvlarni xavfsiz qisqartiramiz (constraint qo'yishdan oldin),
-- shunda mavjud uzun sharhlar tufayli migration to'xtab qolmasin.
update public.reviews
   set comment = left(comment, 500)
 where comment is not null
   and char_length(comment) > 500;

-- Mavjud constraint bo'lsa olib tashlaymiz (idempotent migration).
alter table public.reviews
  drop constraint if exists reviews_comment_length_check;

-- Yangi cheklov: comment NULL bo'lishi yoki 1..500 belgi orasida bo'lishi mumkin.
-- Bo'sh string ham ruxsat berilmaydi — agar foydalanuvchi hech narsa yozmasa,
-- mijoz NULL yuborishi kerak (ProductDetail/Orders ReviewModal shunday qiladi).
alter table public.reviews
  add constraint reviews_comment_length_check
  check (
    comment is null
    or (char_length(comment) between 1 and 500)
  );

comment on constraint reviews_comment_length_check on public.reviews is
  'Sharh izohi maksimum 500 belgi; bo''sh izoh NULL sifatida saqlanadi.';

-- Sovg'a qabul qilinganda buyurtma yaratish (admin panel va Telegram bildirishnomasi ishlashi uchun).
--
-- Muammo: avvalgi `claim_gift` RPC faqat `gifts` jadvalidagi statusni 'claimed' ga o'tkazardi.
-- Lekin admin panel `orders` jadvalini o'qiydi, va Telegram bildirishnomalari ham
-- `orders` jadvali ustidagi Database Webhook orqali ishlaydi. Shuning uchun qabul qilingan
-- sovg'alar hech qaerda ko'rinmasdi.
--
-- Yechim:
--   1) `gifts.payment_method` ustunini qo'shamiz (sovg'a yaratilayotganda yozib qo'yiladi).
--   2) `orders` jadvaliga `gift_id` ustunini qo'shamiz — buyurtma sovg'adan kelib chiqqanini
--      kuzatish va kelajakda ulanish uchun.
--   3) `claim_gift` RPC ichida `gifts` statusi 'claimed' ga o'zgartirilgach, darhol
--      `orders` jadvaliga yangi yozuv qo'yamiz. Buyurtma `user_id` sifatida sovg'a
--      yuboruvchini ko'rsatadi (qabul qiluvchi anonim bo'lishi mumkin), yetkazib berish
--      ma'lumotlari esa qabul qiluvchidan olinadi.

-- ---------------------------------------------------------------------------
-- 1) gifts.payment_method
-- ---------------------------------------------------------------------------
alter table public.gifts
  add column if not exists payment_method text not null default 'cod';

alter table public.gifts drop constraint if exists gifts_payment_method_check;
alter table public.gifts add constraint gifts_payment_method_check
  check (payment_method in ('cod', 'click'));

comment on column public.gifts.payment_method is
  'Sovg''a uchun to''lov usuli: cod=Naqd (yetkazib berishda), click=Click (online).';

-- ---------------------------------------------------------------------------
-- 2) orders.gift_id
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists gift_id uuid references public.gifts(id) on delete set null;

create index if not exists orders_gift_id_idx on public.orders (gift_id);

comment on column public.orders.gift_id is
  'Agar buyurtma sovg''a sifatida yaratilgan bo''lsa — manba sovg''aning IDsi.';

-- ---------------------------------------------------------------------------
-- 3) Yangilangan claim_gift RPC
-- ---------------------------------------------------------------------------
-- Eski signatura saqlanadi (klient kodga teginmaymiz). Lekin endi RPC qo'shimcha
-- ravishda `orders` ga yozuv qo'yadi. Funksiya `security definer` — RLS uni cheklamaydi,
-- shu sababli anonim foydalanuvchi ham buyurtma yarata oladi (sovg'a kontekstida).
create or replace function public.claim_gift(
  p_token text,
  p_recipient_name text,
  p_recipient_phone text,
  p_recipient_address text
)
returns table (
  id uuid,
  token text,
  status text,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift            record;
  v_order_id        uuid;
  v_delivery_region text;
  v_note            text;
  v_order_status    text;
  v_payment_method  text;
  v_now             timestamptz := now();
begin
  -- Sovg'ani topib qulflaymiz (concurrent claim oldini olish uchun).
  select g.*
    into v_gift
    from public.gifts g
    where g.token = p_token
      and g.status = 'pending'
    limit 1
    for update;

  if not found then
    return; -- bo'sh natija — yuqorida UI da "Sovg'a topilmadi" yoki "qabul qilingan" deb chiqadi.
  end if;

  -- Sovg'a statusini yangilaymiz.
  update public.gifts
     set status            = 'claimed',
         recipient_name    = btrim(p_recipient_name),
         recipient_phone   = btrim(p_recipient_phone),
         recipient_address = btrim(p_recipient_address),
         claimed_at        = v_now
   where public.gifts.id = v_gift.id;

  -- Manzilning birinchi qismidan yetkazib berish zonasini olamiz (frontend
  -- formatlari: "Toshkent shahri, Chilonzor tumani, Bunyodkor ko'ch...").
  v_delivery_region := btrim(split_part(p_recipient_address, ',', 1));

  -- Buyurtma uchun izoh — admin tezda farqlay olishi uchun.
  v_note := '🎁 SOVG''A';
  if v_gift.message is not null and btrim(v_gift.message) <> '' then
    v_note := v_note || ' — ' || btrim(v_gift.message);
  end if;

  v_payment_method := coalesce(v_gift.payment_method, 'cod');

  -- Click bilan to'langan sovg'alar avtomatik 'confirmed' ga ketadi
  -- (sender allaqachon to'lagan, faqat yetkazish qoldi). COD — admin tasdiqlaydi.
  if v_payment_method = 'click' then
    v_order_status := 'confirmed';
  else
    v_order_status := 'pending';
  end if;

  -- Yangi buyurtma yaratamiz. `aa_orders_recompute_total` triggeri narxni
  -- products jadvalidan qayta hisoblaydi, shuning uchun total ni 0 deb qoldiramiz.
  insert into public.orders (
    user_id,
    items,
    status,
    full_name,
    phone,
    address,
    delivery_region,
    note,
    payment_method,
    gift_id,
    total
  )
  values (
    v_gift.sender_id,
    jsonb_build_array(jsonb_build_object(
      'product_id',   v_gift.product_id::text,
      'product_name', v_gift.product_name,
      'image',        v_gift.product_image,
      'quantity',     v_gift.quantity
    )),
    v_order_status,
    btrim(p_recipient_name),
    btrim(p_recipient_phone),
    btrim(p_recipient_address),
    v_delivery_region,
    v_note,
    v_payment_method,
    v_gift.id,
    0
  )
  returning public.orders.id into v_order_id;

  -- Qabul qiluvchi UI ga signal — keyingi qadamga o'tish uchun.
  return query
  select v_gift.id, v_gift.token, 'claimed'::text, v_now;
end;
$$;

revoke all on function public.claim_gift(text, text, text, text) from public;
grant execute on function public.claim_gift(text, text, text, text) to anon, authenticated;

comment on function public.claim_gift(text, text, text, text) is
  'Sovg''ani qabul qilish: gifts.status=claimed + orders jadvaliga yangi buyurtma. '
  'Yangi buyurtma yuboruvchi (sender) nomidan yaratiladi, lekin yetkazib berish '
  'ma''lumotlari qabul qiluvchidan olinadi. Bu Database Webhook orqali Telegram '
  'bildirishnomasini va admin panelda ko''rinishni ta''minlaydi.';

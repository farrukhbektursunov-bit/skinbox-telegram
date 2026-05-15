-- =============================================
-- SkinBox xavfsizlik zaifliklarini bartaraf etish
--   #1 — orders.total ni server tomonida hisoblash (BEFORE INSERT trigger)
--   #2 — kupon kodlarini DB ga ko'chirish + RPC tekshiruv
--   #4 — reviews uchun "faqat sotib olganlar baho bersin" RLS policy
--   #5 — set_default_address RPC (race condition siz)
--   #6 — avatars bucket MIME tekshiruvi
-- =============================================

-- ---------- 1) coupons jadvali + namuna kuponlar ----------
create table if not exists public.coupons (
  code          text primary key,
  type          text not null check (type in ('percent','fixed')),
  value         numeric not null check (value >= 0),
  min_subtotal  numeric not null default 0,
  max_uses      integer,
  used_count    integer not null default 0,
  expires_at    timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- Faqat autentifikatsiya qilingan foydalanuvchilar kuponlarni o'qiy oladi
-- (write hech kim emas — admin Dashboard / service_role orqali boshqaradi)
drop policy if exists "Coupons readable" on public.coupons;
create policy "Coupons readable"
  on public.coupons for select
  using (auth.role() = 'authenticated');

-- Avvalgi klient kodidagi kuponlarni ko'chirish (idempotent)
insert into public.coupons (code, type, value, min_subtotal, active)
values
  ('SAVE10', 'percent', 10,      0, true),
  ('SAVE20', 'percent', 20,      0, true),
  ('FREE20', 'fixed',   20000,   0, true),
  ('FREE50', 'fixed',   50000,   0, true)
on conflict (code) do nothing;

-- ---------- 2) Buyurtma jadvaliga qo'shimcha ustunlar ----------
alter table public.orders add column if not exists coupon_code    text;
alter table public.orders add column if not exists subtotal       numeric;
alter table public.orders add column if not exists shipping_cost  numeric not null default 0;
alter table public.orders add column if not exists discount_total numeric not null default 0;

-- ---------- 3) Kupon tekshiruvi RPC (klient preview uchun) ----------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns table (
  code     text,
  type     text,
  value    numeric,
  discount numeric,
  valid    boolean,
  reason   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c        record;
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_sub    numeric := coalesce(p_subtotal, 0);
  v_disc   numeric := 0;
begin
  if v_code = '' then
    return query select v_code, null::text, null::numeric, 0::numeric, false, 'empty'::text;
    return;
  end if;

  select * into c from public.coupons where coupons.code = v_code limit 1;
  if not found then
    return query select v_code, null::text, null::numeric, 0::numeric, false, 'not_found'::text;
    return;
  end if;
  if not c.active then
    return query select c.code, c.type, c.value, 0::numeric, false, 'inactive'::text;
    return;
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return query select c.code, c.type, c.value, 0::numeric, false, 'expired'::text;
    return;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select c.code, c.type, c.value, 0::numeric, false, 'max_uses'::text;
    return;
  end if;
  if v_sub < c.min_subtotal then
    return query select c.code, c.type, c.value, 0::numeric, false, 'min_subtotal'::text;
    return;
  end if;

  if c.type = 'percent' then
    v_disc := round(v_sub * c.value / 100);
  else
    v_disc := least(c.value, v_sub);
  end if;

  return query select c.code, c.type, c.value, v_disc, true, 'ok'::text;
end;
$$;

revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to authenticated;

-- ---------- 4) orders BEFORE INSERT trigger: narxni serverda majburlash ----------
-- Klient yuborgan `total`, `subtotal`, `shipping_cost`, `discount_total`
-- va har bir `items[].price` qiymatlari shu yerda qayta yoziladi.
-- Trigger nomi `aa_` bilan boshlangan — `order_reserve_stock_before_insert`
-- dan oldin ishga tushishi va ombor kamayishi to'g'ri quantity bilan amalga oshishi uchun.

create or replace function public.aa_orders_recompute_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items     jsonb := '[]'::jsonb;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       integer;
  v_unit      numeric;
  v_subtotal  numeric := 0;
  v_shipping  numeric := 0;
  v_discount  numeric := 0;
  v_code      text;
  v_coupon    record;
  v_product   record;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    raise exception 'Buyurtma items bo''sh' using errcode = 'P0001';
  end if;

  -- Har bir item uchun DB dan narxni o'qib, items array ni qayta yig'ish
  for v_item in select * from jsonb_array_elements(new.items)
  loop
    if (v_item->>'product_id') is null or btrim(v_item->>'product_id') = '' then
      -- product_id bo'lmagan eski elementlar — price 0 ga tushiriladi (xavfsiz)
      v_items := v_items || jsonb_build_array(
        v_item || jsonb_build_object('price', 0)
      );
      continue;
    end if;

    v_pid := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::int, 1));

    select p.id, p.price, p.sale_price
      into v_product
      from public.products p
      where p.id = v_pid;

    if not found then
      raise exception 'Mahsulot topilmadi: %', v_pid using errcode = 'P0001';
    end if;

    v_unit := case
      when v_product.sale_price is not null and v_product.sale_price < v_product.price
        then v_product.sale_price
      else v_product.price
    end;

    v_subtotal := v_subtotal + (v_unit * v_qty);

    v_items := v_items || jsonb_build_array(
      v_item
        || jsonb_build_object('price', v_unit)
        || jsonb_build_object('quantity', v_qty)
    );
  end loop;

  -- Kupon tekshiruvi (faqat DB dan)
  v_code := upper(btrim(coalesce(new.coupon_code, '')));
  if v_code <> '' then
    select * into v_coupon from public.coupons where coupons.code = v_code limit 1;
    if found
       and v_coupon.active
       and (v_coupon.expires_at is null or v_coupon.expires_at > now())
       and (v_coupon.max_uses is null or v_coupon.used_count < v_coupon.max_uses)
       and v_subtotal >= v_coupon.min_subtotal
    then
      if v_coupon.type = 'percent' then
        v_discount := round(v_subtotal * v_coupon.value / 100);
      else
        v_discount := least(v_coupon.value, v_subtotal);
      end if;
      new.coupon_code := v_coupon.code;
    else
      v_discount := 0;
      new.coupon_code := null; -- yaroqsiz kupon — e'tibordan chiqarildi
    end if;
  else
    new.coupon_code := null;
  end if;

  -- Yetkazib berish narxi server tomonida (bitta joyda biznes qoidasi)
  if v_subtotal = 0 then
    v_shipping := 0;
  elsif (v_subtotal - v_discount) >= 200000 then
    v_shipping := 0;
  else
    v_shipping := 15000;
  end if;

  new.items          := v_items;
  new.subtotal       := v_subtotal;
  new.discount_total := v_discount;
  new.shipping_cost  := v_shipping;
  new.total          := greatest(0, v_subtotal - v_discount + v_shipping);

  return new;
end;
$$;

drop trigger if exists aa_orders_recompute_total_before_insert on public.orders;
create trigger aa_orders_recompute_total_before_insert
  before insert on public.orders
  for each row
  execute function public.aa_orders_recompute_total();

-- Buyurtma "delivered" ga o'tganda — kupon ishlatilganlik sonini oshirish
create or replace function public.bump_coupon_usage_on_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coupon_code is not null
     and new.status in ('confirmed','delivering','delivered')
     and (old.status is null or old.status not in ('confirmed','delivering','delivered'))
  then
    update public.coupons
      set used_count = used_count + 1
      where coupons.code = new.coupon_code;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_coupon_usage_on_status_change on public.orders;
create trigger bump_coupon_usage_on_status_change
  after update of status on public.orders
  for each row
  execute function public.bump_coupon_usage_on_delivered();

-- ---------- 5) reviews — faqat sotib olganlar baho bersin ----------
create or replace function public.has_purchased_product(p_user_id uuid, p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.orders o,
           jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
     where o.user_id = p_user_id
       and o.status in ('confirmed','delivering','delivered')
       and (item->>'product_id') is not null
       and (item->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
       and (item->>'product_id')::uuid = p_product_id
  );
$$;

revoke all on function public.has_purchased_product(uuid, uuid) from public;
grant execute on function public.has_purchased_product(uuid, uuid) to authenticated;

drop policy if exists "O'z reviewini qo'shadi" on public.reviews;
drop policy if exists "O'z reviewini yangilaydi" on public.reviews;
drop policy if exists "O'z reviewini qo'shadi (sotib olganlar)" on public.reviews;
drop policy if exists "O'z reviewini yangilaydi (sotib olganlar)" on public.reviews;

create policy "O'z reviewini qo'shadi (sotib olganlar)"
  on public.reviews for insert
  with check (
    auth.uid() = user_id
    and public.has_purchased_product(auth.uid(), product_id)
  );

create policy "O'z reviewini yangilaydi (sotib olganlar)"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.has_purchased_product(auth.uid(), product_id)
  );

-- ---------- 6) set_default_address RPC (atomik) ----------
create or replace function public.set_default_address(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.addresses
     where id = p_id and user_id = v_user
  ) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  update public.addresses
    set is_default = false
    where user_id = v_user
      and is_default = true;

  update public.addresses
    set is_default = true
    where id = p_id
      and user_id = v_user;
end;
$$;

revoke all on function public.set_default_address(uuid) from public;
grant execute on function public.set_default_address(uuid) to authenticated;

-- ---------- 7) gifts BEFORE INSERT: narxni serverdan tortib olish ----------
-- click-prepare gift uchun amount tekshiruvi `gift.price * gift.quantity` ga asoslanadi.
-- Klient narxni soxtalashtirsa, kichik summaga gift to'lab, asl mahsulot olishi mumkin.
-- Shuning uchun gift.price ham DB dan olinadi.
create or replace function public.gifts_validate_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_unit    numeric;
begin
  select p.id, p.price, p.sale_price
    into v_product
    from public.products p
    where p.id = new.product_id;

  if not found then
    raise exception 'Mahsulot topilmadi' using errcode = 'P0001';
  end if;

  v_unit := case
    when v_product.sale_price is not null and v_product.sale_price < v_product.price
      then v_product.sale_price
    else v_product.price
  end;

  new.price := v_unit;
  if new.quantity is null or new.quantity < 1 then
    new.quantity := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists gifts_validate_price_before_insert on public.gifts;
create trigger gifts_validate_price_before_insert
  before insert on public.gifts
  for each row
  execute function public.gifts_validate_price();

-- ---------- 8) avatars bucket: MIME va hajm cheklovi ----------
-- Faqat tasvir fayllar yuklansin (kengaytma emas, server tomonida MIME tekshiruvi).
do $$
begin
  if exists (select 1 from storage.buckets where id = 'avatars') then
    update storage.buckets
      set allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp','image/gif'],
          file_size_limit    = 2 * 1024 * 1024
      where id = 'avatars';
  end if;
end $$;

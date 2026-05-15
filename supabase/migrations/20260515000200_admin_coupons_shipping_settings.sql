-- =============================================
-- Admin panel: kuponlarni boshqarish + pochta (yetkazib berish) narxi sozlamasi
--   1) app_settings key/value jadvali (shipping_cost, free_shipping_min)
--   2) coupons va app_settings ustidan admin (RLS) write huquqlari
--   3) aa_orders_recompute_total trigger — endi shipping narxini app_settings dan oladi
-- =============================================

-- ---------- 1) app_settings jadvali ----------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

alter table public.app_settings enable row level security;

-- O'qish: hamma autentifikatsiya qilingan foydalanuvchiga ruxsat
-- (storefront ham preview uchun shu qiymatlarni o'qishi mumkin bo'lsin)
drop policy if exists "App settings readable" on public.app_settings;
create policy "App settings readable"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

-- Yozish: faqat admin
drop policy if exists "App settings admin insert" on public.app_settings;
create policy "App settings admin insert"
  on public.app_settings for insert
  with check (public.is_admin());

drop policy if exists "App settings admin update" on public.app_settings;
create policy "App settings admin update"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "App settings admin delete" on public.app_settings;
create policy "App settings admin delete"
  on public.app_settings for delete
  using (public.is_admin());

-- Default qiymatlar (eski hardcoded narxlar bilan bir xil)
insert into public.app_settings (key, value)
values
  ('shipping_cost',     to_jsonb(15000)),
  ('free_shipping_min', to_jsonb(200000))
on conflict (key) do nothing;

-- ---------- 2) coupons admin RLS ----------
-- Avvalgi migration faqat select uchun policy bergan edi.
-- Admin uchun to'liq write huquqlarini qo'shamiz.
drop policy if exists "Coupons admin insert" on public.coupons;
create policy "Coupons admin insert"
  on public.coupons for insert
  with check (public.is_admin());

drop policy if exists "Coupons admin update" on public.coupons;
create policy "Coupons admin update"
  on public.coupons for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Coupons admin delete" on public.coupons;
create policy "Coupons admin delete"
  on public.coupons for delete
  using (public.is_admin());

-- Admin barcha kuponlarni ko'rishi uchun alohida policy
-- (eski "Coupons readable" allaqachon authenticated ga ruxsat beradi,
--  shuning uchun admin ham ko'radi — qo'shimcha policy shart emas)

-- ---------- 3) Yetkazib berish narxi sozlamadan o'qiladigan helper ----------
create or replace function public.get_app_setting_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when jsonb_typeof(value) = 'number' then (value)::text::numeric
        when jsonb_typeof(value) = 'string' then nullif(value #>> '{}', '')::numeric
        else null
      end
      from public.app_settings
      where key = p_key
    ),
    p_default
  );
$$;

revoke all on function public.get_app_setting_numeric(text, numeric) from public;
grant execute on function public.get_app_setting_numeric(text, numeric) to authenticated;

-- ---------- 4) aa_orders_recompute_total — shipping narxini app_settings dan o'qish ----------
create or replace function public.aa_orders_recompute_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items         jsonb := '[]'::jsonb;
  v_item          jsonb;
  v_pid           uuid;
  v_qty           integer;
  v_unit          numeric;
  v_subtotal      numeric := 0;
  v_shipping      numeric := 0;
  v_discount      numeric := 0;
  v_code          text;
  v_coupon        record;
  v_product       record;
  v_ship_cost     numeric := public.get_app_setting_numeric('shipping_cost', 15000);
  v_free_min      numeric := public.get_app_setting_numeric('free_shipping_min', 200000);
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    raise exception 'Buyurtma items bo''sh' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(new.items)
  loop
    if (v_item->>'product_id') is null or btrim(v_item->>'product_id') = '' then
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
      new.coupon_code := null;
    end if;
  else
    new.coupon_code := null;
  end if;

  -- Yetkazib berish narxi — endi app_settings dan
  if v_subtotal = 0 then
    v_shipping := 0;
  elsif v_free_min > 0 and (v_subtotal - v_discount) >= v_free_min then
    v_shipping := 0;
  else
    v_shipping := coalesce(v_ship_cost, 0);
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

-- ---------- 5) updated_at avtomatik yangilanishi ----------
create or replace function public.app_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists app_settings_touch_before_write on public.app_settings;
create trigger app_settings_touch_before_write
  before insert or update on public.app_settings
  for each row
  execute function public.app_settings_touch_updated_at();

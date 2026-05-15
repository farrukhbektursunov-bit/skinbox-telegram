-- Yetkazib berish: Toshkent shahri va viloyatlar uchun alohida narxlar
--   * app_settings: shipping_cost_tashkent, shipping_cost_regions
--   * orders.delivery_region — mijoz tanlagan viloyat (masalan "Toshkent shahri")
--   * aa_orders_recompute_total — tanlov bo'yicha narxni qo'llaydi

alter table public.orders add column if not exists delivery_region text;

comment on column public.orders.delivery_region is
  'Yetkazib berish zonasi (masalan Toshkent shahri yoki boshqa viloyat nomi). Pochta narxi shu qiymatga qarab hisoblanadi.';

-- Eski bitta shipping_cost qiymatidan ikkala yangi kalitni to'ldirish (mavjud deploylar uchun)
do $$
declare
  v_ship jsonb;
begin
  select value into v_ship from public.app_settings where key = 'shipping_cost' limit 1;
  if v_ship is null then
    v_ship := to_jsonb(15000);
  end if;
  insert into public.app_settings (key, value) values
    ('shipping_cost_tashkent', v_ship)
  on conflict (key) do nothing;
  insert into public.app_settings (key, value) values
    ('shipping_cost_regions', v_ship)
  on conflict (key) do nothing;
end $$;

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
  v_legacy_ship   numeric := public.get_app_setting_numeric('shipping_cost', 15000);
  v_ship_tashkent numeric := public.get_app_setting_numeric('shipping_cost_tashkent', v_legacy_ship);
  v_ship_regions  numeric := public.get_app_setting_numeric('shipping_cost_regions', v_legacy_ship);
  v_free_min      numeric := public.get_app_setting_numeric('free_shipping_min', 200000);
  v_delivery_reg  text;
  v_ship_pick     numeric;
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

  v_delivery_reg := btrim(coalesce(new.delivery_region, ''));
  if v_delivery_reg = 'Toshkent shahri' then
    v_ship_pick := coalesce(v_ship_tashkent, 0);
  else
    v_ship_pick := coalesce(v_ship_regions, 0);
  end if;

  if v_subtotal = 0 then
    v_shipping := 0;
  elsif v_free_min > 0 and (v_subtotal - v_discount) >= v_free_min then
    v_shipping := 0;
  else
    v_shipping := v_ship_pick;
  end if;

  new.items          := v_items;
  new.subtotal       := v_subtotal;
  new.discount_total := v_discount;
  new.shipping_cost  := v_shipping;
  new.total          := greatest(0, v_subtotal - v_discount + v_shipping);

  return new;
end;
$$;

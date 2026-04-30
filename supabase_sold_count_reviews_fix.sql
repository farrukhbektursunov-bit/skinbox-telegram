-- =============================================
-- Mahsulot sahifasida baho va sotuvlar soni ko'rinishi uchun
-- Supabase SQL Editor da ishga tushiring
-- =============================================

-- 1. Buyurtma "delivered" bo'lganda products.sold_count ni oshirish
create or replace function public.increment_sold_count_on_delivered()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  pid uuid;
  qty int;
begin
  if new.status = 'delivered' and (old.status is null or old.status != 'delivered') then
    for item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
    loop
      pid := (item->>'product_id')::uuid;
      qty := coalesce((item->>'quantity')::int, 1);
      if pid is not null and qty > 0 then
        update public.products set sold_count = coalesce(sold_count, 0) + qty where id = pid;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_delivered_increment_sold on public.orders;
create trigger on_order_delivered_increment_sold
  after insert or update of status on public.orders
  for each row execute function public.increment_sold_count_on_delivered();

-- 2. Mavjud delivered buyurtmalar uchun sold_count ni to'ldirish
update public.products p
set sold_count = coalesce(subq.total, 0)
from (
  select (item->>'product_id')::uuid as product_id,
    sum(coalesce((item->>'quantity')::int, 1))::int as total
  from public.orders o, jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
  where o.status = 'delivered' and (item->>'product_id') is not null
  group by (item->>'product_id')::uuid
) subq
where p.id = subq.product_id;

-- 3. RPC: mahsulotning haqiqiy sotuvlar sonini buyurtmalardan hisoblash
--    (trigger ishlamasa ham to'g'ri ko'rsatish uchun)
create or replace function public.get_product_sold_count(p_product_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    coalesce((item->>'quantity')::int, 1)
  ), 0)::int
  from public.orders o, jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
  where o.status = 'delivered'
    and (item->>'product_id')::uuid = p_product_id;
$$;
revoke all on function public.get_product_sold_count(uuid) from public;
grant execute on function public.get_product_sold_count(uuid) to authenticated;
grant execute on function public.get_product_sold_count(uuid) to anon;

-- 4. Izohlar uchun profiles policy (muallif ismini ko'rsatish - ixtiyoriy)
-- drop policy if exists "Izohlar uchun profil ko'rish" on public.profiles;
-- create policy "Izohlar uchun profil ko'rish"
--   on public.profiles for select using (auth.role() = 'authenticated');

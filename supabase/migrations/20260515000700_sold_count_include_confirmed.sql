-- =============================================
-- Sotuvlar sonini "delivered" emas, balki
-- "confirmed | delivering | delivered" holatlaridan birida bo'lgan
-- har qanday buyurtmadan hisoblash.
--
-- Sabab: Mijoz buyurtmani tasdiqlatib (confirmed) izoh qoldira oladi,
-- shuning uchun mahsulot sahifasidagi "N ta sotilgan" hisoblagichi
-- shu paytdayoq ko'rinishi kerak. Avvalgi versiyada faqat
-- "delivered" buyurtmalar sanalardi va yangi sotuv "0 ta sotilgan"
-- bo'lib turardi.
-- =============================================

-- 1. RPC: real vaqt sotuvlar sonini (confirmed/delivering/delivered)
--    buyurtmalardan hisoblaydi.
create or replace function public.get_product_sold_count(p_product_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce((item->>'quantity')::int, 1)), 0)::int
  from public.orders o,
    jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
  where o.status in ('confirmed','delivering','delivered')
    and (item->>'product_id')::uuid = p_product_id;
$$;

revoke all on function public.get_product_sold_count(uuid) from public;
grant execute on function public.get_product_sold_count(uuid) to authenticated;
grant execute on function public.get_product_sold_count(uuid) to anon;

-- 2. Trigger: buyurtma birinchi marta "sold" guruhiga
--    (confirmed | delivering | delivered) o'tganda
--    products.sold_count ni mos miqdorga oshiradi. Buyurtma shu
--    guruh ichida bir holatdan boshqasiga o'tganda qayta sanamaydi.
create or replace function public.increment_sold_count_on_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid uuid;
  qty int;
  was_sold boolean;
  is_sold  boolean;
begin
  was_sold := old.status is not null
              and old.status in ('confirmed','delivering','delivered');
  is_sold  := new.status in ('confirmed','delivering','delivered');

  if is_sold and not was_sold then
    for item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
    loop
      pid := (item->>'product_id')::uuid;
      qty := coalesce((item->>'quantity')::int, 1);
      if pid is not null and qty > 0 then
        update public.products
           set sold_count = coalesce(sold_count, 0) + qty
         where id = pid;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_delivered_increment_sold on public.orders;
create trigger on_order_delivered_increment_sold
  after insert or update of status
  on public.orders
  for each row
  execute function public.increment_sold_count_on_delivered();

-- 3. Mavjud buyurtmalar bo'yicha products.sold_count ni qayta hisoblash
--    (idempotent — istalgan paytda qayta ishga tushirish mumkin).
update public.products p
   set sold_count = coalesce(subq.total, 0)
  from (
    select (item->>'product_id')::uuid as product_id,
      sum(coalesce((item->>'quantity')::int, 1))::int as total
    from public.orders o,
      jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
    where o.status in ('confirmed','delivering','delivered')
      and (item->>'product_id') is not null
      and (item->>'product_id') ~ '^[0-9a-fA-F-]{36}$'
    group by (item->>'product_id')::uuid
  ) subq
 where p.id = subq.product_id;

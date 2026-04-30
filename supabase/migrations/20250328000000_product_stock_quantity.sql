-- Ombordagi dona soni: buyurtma qilinganda kamayadi, bekor qilinganda qaytadi
-- stock_quantity = 0 bo'lganda in_stock = false

alter table public.products add column if not exists stock_quantity integer not null default 0;

-- Mavjud mahsulotlar: katalogda qolganlar uchun boshlang‘ich zaxira
update public.products
set stock_quantity = greatest(stock_quantity, 50)
where coalesce(in_stock, true) = true and stock_quantity = 0;

create or replace function public.order_reserve_stock_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid uuid;
  qty int;
  cur int;
  new_stock int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  for item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    if (item->>'product_id') is null or trim(item->>'product_id') = '' then
      continue;
    end if;
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::int, 1);
    if qty < 1 then
      continue;
    end if;
    select p.stock_quantity into cur from public.products p where p.id = pid for update;
    if not found then
      raise exception 'Mahsulot topilmadi';
    end if;
    if cur < qty then
      raise exception 'Omborda yetarli mahsulot yo''q';
    end if;
    new_stock := cur - qty;
    update public.products
    set stock_quantity = new_stock,
        in_stock = (new_stock > 0)
    where id = pid;
  end loop;
  return new;
end;
$$;

drop trigger if exists order_reserve_stock_before_insert on public.orders;
create trigger order_reserve_stock_before_insert
  before insert on public.orders
  for each row
  execute function public.order_reserve_stock_on_insert();

create or replace function public.order_restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid uuid;
  qty int;
  cur int;
  new_stock int;
begin
  if new.status is distinct from 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;
  for item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    if (item->>'product_id') is null or trim(item->>'product_id') = '' then
      continue;
    end if;
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::int, 1);
    if qty < 1 then
      continue;
    end if;
    select p.stock_quantity into cur from public.products p where p.id = pid for update;
    if not found then
      continue;
    end if;
    new_stock := cur + qty;
    update public.products
    set stock_quantity = new_stock,
        in_stock = (new_stock > 0)
    where id = pid;
  end loop;
  return new;
end;
$$;

drop trigger if exists order_restore_stock_on_cancel on public.orders;
create trigger order_restore_stock_on_cancel
  after update of status on public.orders
  for each row
  execute function public.order_restore_stock_on_cancel();

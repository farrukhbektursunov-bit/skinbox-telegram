-- Gift token flow uchun RLS bypass qiladigan xavfsiz RPC funksiyalar.
-- Bu funksiyalar token tekshiruvini serverda bajaradi va anonim claim oqimini qo'llab-quvvatlaydi.

create or replace function public.get_gift_by_token(p_token text)
returns table (
  id uuid,
  token text,
  status text,
  product_name text,
  product_image text,
  quantity integer,
  message text,
  product_brand text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    g.id,
    g.token,
    g.status,
    g.product_name,
    g.product_image,
    g.quantity,
    g.message,
    p.brand as product_brand
  from public.gifts g
  left join public.products p on p.id = g.product_id
  where g.token = p_token
  limit 1;
end;
$$;

revoke all on function public.get_gift_by_token(text) from public;
grant execute on function public.get_gift_by_token(text) to anon, authenticated;

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
begin
  return query
  update public.gifts g
  set
    status = 'claimed',
    recipient_name = btrim(p_recipient_name),
    recipient_phone = btrim(p_recipient_phone),
    recipient_address = btrim(p_recipient_address),
    claimed_at = now()
  where g.token = p_token
    and g.status = 'pending'
  returning g.id, g.token, g.status, g.claimed_at;
end;
$$;

revoke all on function public.claim_gift(text, text, text, text) from public;
grant execute on function public.claim_gift(text, text, text, text) to anon, authenticated;

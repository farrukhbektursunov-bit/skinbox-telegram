-- Click to'lovini sovg'a oqimiga ham ulash.
-- gift:<gifts.id> transaction_param bilan kelgan Click callbacklar shu sovg'ani tasdiqlaydi.

alter table public.gifts drop constraint if exists gifts_status_check;
alter table public.gifts add constraint gifts_status_check
  check (status in (
    'awaiting_payment',
    'pending',
    'claimed',
    'delivered',
    'cancelled'
  ));

comment on column public.gifts.status is
  'awaiting_payment=Click kutilmoqda; pending=to''langan, claim qilish mumkin; claimed/delivered/cancelled';

alter table public.click_payment_prepare
  alter column order_id drop not null,
  add column if not exists gift_id uuid references public.gifts (id) on delete cascade;

alter table public.click_payment_prepare drop constraint if exists click_payment_prepare_target_check;
alter table public.click_payment_prepare add constraint click_payment_prepare_target_check
  check (
    (order_id is not null and gift_id is null)
    or (order_id is null and gift_id is not null)
  );

create index if not exists click_payment_prepare_gift_id_idx
  on public.click_payment_prepare (gift_id);

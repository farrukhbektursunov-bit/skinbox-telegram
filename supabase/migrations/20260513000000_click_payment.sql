-- Click to'lovi: buyurtma holati va Prepare/Complete uchun jadval
-- SHOP API: https://docs.click.uz (Prepare / Complete)

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'pending',
    'awaiting_payment',
    'confirmed',
    'delivering',
    'delivered',
    'cancelled'
  ));

comment on column public.orders.status is
  'pending=to''lov yoki qayta ishlash; awaiting_payment=Click kutilmoqda; confirmed+';

create table if not exists public.click_payment_prepare (
  id                bigserial primary key,
  order_id          uuid not null references public.orders (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  click_trans_id    bigint not null unique,
  click_paydoc_id   bigint,
  amount            numeric not null,
  prepared_at       timestamptz not null default now(),
  completed_at      timestamptz,
  cancelled_at      timestamptz
);

create index if not exists click_payment_prepare_order_id_idx
  on public.click_payment_prepare (order_id);

alter table public.click_payment_prepare enable row level security;

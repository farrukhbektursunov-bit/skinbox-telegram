-- =============================================
-- orders.payment_method ustuni
-- Telegram bildirishnomalarida (notify-telegram edge function)
-- "Click (online)" yoki "Naqd (yetkazib berishda)" ko'rinishi uchun.
-- =============================================

alter table public.orders
  add column if not exists payment_method text;

-- Eski yozuvlar uchun ma'lum bo'lgan qoidalar:
--   * status = 'awaiting_payment'  →  Click (to'lov kutilmoqda)
--   * boshqa hollarda              →  cod  (yetkazib berishda naqd)
update public.orders
   set payment_method = case
     when status = 'awaiting_payment' then 'click'
     else 'cod'
   end
 where payment_method is null;

alter table public.orders
  alter column payment_method set default 'cod',
  alter column payment_method set not null;

alter table public.orders
  drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cod','click'));

comment on column public.orders.payment_method is
  'To''lov usuli: cod=Naqd (yetkazib berishda), click=Click (online)';

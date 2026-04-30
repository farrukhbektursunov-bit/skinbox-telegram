-- =============================================
-- SkinBox - Supabase SQL Schema
-- Supabase SQL Editor da ishga tushiring
-- =============================================

-- 1. PRODUCTS jadvali (admin qo'shadi)
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text,
  description text,
  price       numeric not null,
  image_url   text,
  category    text, -- product_categories.slug (ixtiyoriy); cheklov olib tashlash: admin-panel/supabase-category-hierarchy.sql
  rating      numeric check (rating >= 0 and rating <= 5),
  in_stock    boolean default true,
  stock_quantity integer not null default 0,
  created_at  timestamptz default now()
);

-- 2. CART_ITEMS jadvali (har foydalanuvchiga alohida)
create table if not exists public.cart_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  product_name  text not null,
  product_image text,
  price         numeric not null,
  quantity      integer not null default 1 check (quantity > 0),
  created_at    timestamptz default now()
);

-- 3. FAVORITES jadvali (har foydalanuvchiga alohida)
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, product_id)
);

-- 4. PROFILES jadvali (ixtiyoriy - foydalanuvchi ismi uchun)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) - MUHIM!
-- Har foydalanuvchi faqat o'z ma'lumotlarini ko'radi
-- =============================================

-- Products: hamma o'qiy oladi, faqat admin yoza oladi
alter table public.products enable row level security;
create policy "Hamma mahsulotlarni ko'ra oladi"
  on public.products for select using (true);

-- Cart: faqat o'z savatini ko'radi va o'zgartiradi
alter table public.cart_items enable row level security;
create policy "O'z savatini ko'radi"
  on public.cart_items for select using (auth.uid() = user_id);
create policy "O'z savatiga qo'shadi"
  on public.cart_items for insert with check (auth.uid() = user_id);
create policy "O'z savatini o'zgartiradi"
  on public.cart_items for update using (auth.uid() = user_id);
create policy "O'z savatidan o'chiradi"
  on public.cart_items for delete using (auth.uid() = user_id);

-- Favorites: faqat o'z sevimlilarini ko'radi
alter table public.favorites enable row level security;
create policy "O'z sevimlilarini ko'radi"
  on public.favorites for select using (auth.uid() = user_id);
create policy "O'z sevimlilariga qo'shadi"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "O'z sevimlilaridan o'chiradi"
  on public.favorites for delete using (auth.uid() = user_id);

-- Profiles: faqat o'z profilini ko'radi
alter table public.profiles enable row level security;
create policy "O'z profilini ko'radi"
  on public.profiles for select using (auth.uid() = id);
create policy "O'z profilini yangilaydi"
  on public.profiles for update using (auth.uid() = id);
create policy "Profil yaratadi"
  on public.profiles for insert with check (auth.uid() = id);

-- =============================================
-- NAMUNA MAHSULOTLAR (ixtiyoriy)
-- =============================================
insert into public.products (name, brand, price, category, rating, description) values
  ('Foam Cleanser', 'CeraVe',    45000, 'cleansers',    4.8, 'Yumshoq ko''pik tozalagich'),
  ('Niacinamide Serum', 'The Ordinary', 89000, 'serums', 4.7, '10% niacinamide serum'),
  ('Moisturizing Cream', 'Neutrogena', 67000, 'moisturizers', 4.6, 'Namlovchi krem'),
  ('Toner Essence', 'COSRX',     55000, 'toners',       4.5, 'Yumshatuvchi toner'),
  ('Clay Mask', 'Innisfree',     72000, 'masks',        4.4, 'Gil niqob'),
  ('SPF 50+ Sunscreen', 'La Roche-Posay', 120000, 'sunscreen', 4.9, 'Quyoshdan himoya kremi');

-- =============================================
-- ORDERS jadvali (yuqoridagi schema ga qo'shimcha)
-- Supabase SQL Editor da alohida ishga tushiring
-- =============================================

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  items       jsonb not null,
  total       numeric not null,
  status      text not null default 'pending'
              check (status in ('pending','confirmed','delivering','delivered','cancelled')),
  address     text not null,
  phone       text not null,
  full_name   text not null,
  note        text,
  created_at  timestamptz default now()
);

alter table public.orders enable row level security;
create policy "O'z buyurtmalarini ko'radi"
  on public.orders for select using (auth.uid() = user_id);
create policy "Buyurtma yaratadi"
  on public.orders for insert with check (auth.uid() = user_id);

-- =============================================
-- PROFIL BO'LIMI UCHUN JADVALLAR
-- =============================================

-- Manzillar
create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  full_name    text not null,
  phone        text not null,
  region       text not null,
  district     text not null,
  address      text not null,
  building_number    text,
  apartment_number   text,
  -- Legacy: entrance_password saqlanmasin, faqat umumiy izoh (maxfiy bo'lmagan)
  entrance_note      text,
  delivery_instruction text,
  is_default   boolean default false,
  created_at   timestamptz default now()
);
alter table public.addresses enable row level security;
create policy "Manzillar - ko'rish"  on public.addresses for select using (auth.uid() = user_id);
create policy "Manzillar - qo'shish" on public.addresses for insert with check (auth.uid() = user_id);
create policy "Manzillar - tahrirlash" on public.addresses for update using (auth.uid() = user_id);
create policy "Manzillar - o'chirish" on public.addresses for delete using (auth.uid() = user_id);

-- To'lov usullari (karta)
create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  card_type    text default 'uzcard',
  card_last4   text not null,
  card_name    text not null,
  is_default   boolean default false,
  created_at   timestamptz default now()
);
alter table public.payment_methods enable row level security;
create policy "Kartalar - ko'rish"    on public.payment_methods for select using (auth.uid() = user_id);
create policy "Kartalar - qo'shish"   on public.payment_methods for insert with check (auth.uid() = user_id);
create policy "Kartalar - tahrirlash" on public.payment_methods for update using (auth.uid() = user_id);
create policy "Kartalar - o'chirish"  on public.payment_methods for delete using (auth.uid() = user_id);

-- =============================================
-- PROFILES jadvaliga ustunlar qo'shish
-- (Agar profiles jadvali allaqachon yaratilgan bo'lsa)
-- =============================================
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists gender     text check (gender in ('male','female') or gender is null);

-- Supabase Storage: avatar yuklash uchun bucket yaratish
-- Supabase Dashboard → Storage → New Bucket → "avatars" → Public: true

-- =============================================
-- MAHSULOT ICHKI SAHIFASI UCHUN
-- =============================================

-- Products jadvaliga qo'shimcha ustunlar
alter table public.products add column if not exists sold_count  integer default 0;
alter table public.products add column if not exists images      text[];   -- qo'shimcha rasmlar

-- Reviews (baholar)
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique(user_id, product_id)
);
alter table public.reviews enable row level security;
create policy "Reviewlarni hamma ko'ra oladi"
  on public.reviews for select using (true);
create policy "O'z reviewini qo'shadi"
  on public.reviews for insert with check (auth.uid() = user_id);
create policy "O'z reviewini yangilaydi"
  on public.reviews for update using (auth.uid() = user_id);
create policy "O'z reviewini o'chiradi"
  on public.reviews for delete using (auth.uid() = user_id);

-- =============================================
-- DO'STGA SOVG'A QILISH
-- =============================================
create table if not exists public.gifts (
  id            uuid primary key default gen_random_uuid(),
  token         text unique not null default encode(gen_random_bytes(16), 'hex'),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  product_name  text not null,
  product_image text,
  price         numeric not null,
  quantity      integer not null default 1,
  message       text,
  status        text not null default 'pending'
                check (status in ('pending','claimed','delivered','cancelled')),
  recipient_name    text,
  recipient_phone   text,
  recipient_address text,
  claimed_at    timestamptz,
  created_at    timestamptz default now()
);

alter table public.gifts enable row level security;

-- Yuboruvchi o'z sovg'asini ko'ra oladi
create policy "Yuboruvchi o'z sovg'asini ko'radi"
  on public.gifts for select using (auth.uid() = sender_id);

-- Token orqali ko'rish:
-- token JWT custom claim ichida `gift_token` sifatida kelishi kerak.
create policy "Token orqali ko'rish"
  on public.gifts for select using (
    auth.uid() = sender_id
    or token = coalesce(
      (current_setting('request.jwt.claims', true)::json ->> 'gift_token'),
      ''
    )
  );

-- Yaratish
create policy "Sovg'a yaratadi"
  on public.gifts for insert with check (auth.uid() = sender_id);

-- Yangilash (claim qilish, manzil kiritish)
create policy "Sovg'ani yangilash"
  on public.gifts for update using (
    status = 'pending'
    and token = coalesce(
      (current_setting('request.jwt.claims', true)::json ->> 'gift_token'),
      ''
    )
  )
  with check (
    status in ('pending', 'claimed', 'delivered', 'cancelled')
    and token = coalesce(
      (current_setting('request.jwt.claims', true)::json ->> 'gift_token'),
      ''
    )
  );

-- =============================================
-- MAHSULOT VARIANTLARI (rang, hajm va h.k.)
-- =============================================
create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  type        text not null check (type in ('color','size','volume','weight','other')),
  label       text not null,       -- ko'rsatiladigan nom: "50ml", "L", "Qizil"
  value       text not null,       -- ichki qiymat: "50ml", "large", "#FF0000"
  color_hex   text,                -- faqat color uchun: "#FF0000"
  price_diff  numeric default 0,   -- asosiy narxdan farq (+ yoki -)
  in_stock    boolean default true,
  image_url   text,                -- bu variant uchun alohida rasm (ixtiyoriy)
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.product_variants enable row level security;
create policy "Variantlarni hamma ko'ra oladi"
  on public.product_variants for select using (true);

-- Namuna: products jadvaliga variant qo'shish
-- insert into product_variants (product_id, type, label, value, color_hex, price_diff, in_stock)
-- values
--   ('uuid...', 'color', 'Qizil',   'red',    '#E53E3E', 0,     true),
--   ('uuid...', 'color', 'Pushti',  'pink',   '#ED64A6', 0,     true),
--   ('uuid...', 'color', 'To''q',   'dark',   '#2D3748', 5000,  false),
--   ('uuid...', 'size',  'S',       'small',  null,      0,     true),
--   ('uuid...', 'size',  'M',       'medium', null,      0,     true),
--   ('uuid...', 'size',  'L',       'large',  null,      5000,  true),
--   ('uuid...', 'volume','50ml',    '50ml',   null,      0,     true),
--   ('uuid...', 'volume','100ml',   '100ml',  null,      15000, true);

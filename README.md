# SkinBox — Go'zallik mahsulotlari do'koni

React + Vite + Supabase + Tailwind CSS bilan qurilgan.

---

## 1. Supabase sozlash

1. [supabase.com](https://supabase.com) ga kiring va yangi project yarating
2. **SQL Editor** ga o'ting va `supabase_schema.sql` faylini to'liq nusxalab ishga tushiring
3. **Project Settings → API** bo'limidan quyidagilarni oling:
   - `Project URL`
   - `anon public` key

---

## 2. Environment variables

`.env.example` faylini `.env.local` nomi bilan nusxalang:

```bash
cp .env.example .env.local
```

`.env.local` faylini oching va qiymatlarni kiriting:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_CLICK_MERCHANT_ID=60990
VITE_CLICK_SERVICE_ID=103017
VITE_CLICK_MERCHANT_USER_ID=84363
```

`SECRET_KEY` ni **hech qachon** frontend `.env` ga qo'ymang — faqat Supabase Edge Functions secrets da (bo'lim 5).

---

## 3. Lokal ishga tushirish

```bash
npm install
npm run dev
```

---

## 4. Vercel ga deploy qilish

1. GitHub ga push qiling
2. [vercel.com](https://vercel.com) da yangi project import qiling
3. **Environment Variables** bo'limiga qo'shing:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLICK_MERCHANT_ID`, `VITE_CLICK_SERVICE_ID`, `VITE_CLICK_MERCHANT_USER_ID` (Click uchun)
4. Deploy tugmasini bosing ✅

---

## 5. Click to'lovi (SHOP API)

[Click hujjatlari](https://docs.click.uz): savatda **Click orqali onlayn** tanlanganda buyurtma `awaiting_payment` holatida yaratiladi va foydalanuvchi `my.click.uz/services/pay` ga yo'naltiriladi. **Prepare** va **Complete** so'rovlari serverda (Edge Function) MD5 imzo bilan qayta ishlanadi.

### 5.1 SQL migratsiya

Supabase **SQL Editor** yoki CLI: `supabase/migrations/20260513000000_click_payment.sql` ni ishga tushiring (`awaiting_payment` holati va `click_payment_prepare` jadvali).

### 5.2 Edge Functions

```bash
supabase secrets set CLICK_SECRET_KEY="SIZNING_SECRET_KEY" CLICK_SERVICE_ID="103017"
supabase functions deploy click-prepare
supabase functions deploy click-complete
```

`supabase/config.toml` da `verify_jwt = false` — Click serverdan JWT siz POST keladi.

Click kabinetida **Prepare URL** va **Complete URL**:

- `https://<project-ref>.supabase.co/functions/v1/click-prepare`
- `https://<project-ref>.supabase.co/functions/v1/click-complete`

Frontend `.env` da faqat `VITE_CLICK_MERCHANT_ID`, `VITE_CLICK_SERVICE_ID`, `VITE_CLICK_MERCHANT_USER_ID` (ochiq ma'lumot); `SECRET_KEY` faqat yuqoridagi secrets da.

---

## Loyiha tuzilmasi

```
src/
├── api/
│   └── supabase.js          # Supabase client
├── components/
│   └── shop/
│       ├── AppLayout.jsx    # Bottom navigation
│       ├── Header.jsx
│       ├── SearchBar.jsx
│       ├── CategoryScroller.jsx
│       └── ProductGrid.jsx  # Mahsulot kartochkalari
├── lib/
│   ├── AuthContext.jsx      # Login/logout/signup
│   ├── queryClient.js       # React Query
│   └── utils.js
├── pages/
│   ├── Login.jsx
│   ├── Shop.jsx
│   ├── SearchPage.jsx
│   ├── Categories.jsx
│   ├── Cart.jsx             # Foydalanuvchiga alohida
│   ├── Favorites.jsx        # Foydalanuvchiga alohida
│   └── Profile.jsx
└── App.jsx
```

## Xususiyatlar

- ✅ Supabase Auth (email/parol)
- ✅ Har foydalanuvchi o'z savati va sevimlilarini ko'radi (RLS)
- ✅ Mahsulot qidirish va kategoriya bo'yicha filter
- ✅ Savatdagi miqdorni o'zgartirish
- ✅ Click onlayn to'lovi (SHOP API + Edge Functions)

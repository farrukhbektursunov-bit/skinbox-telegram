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
```

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
4. Deploy tugmasini bosing ✅

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
- ✅ Vercel deploy tayyor

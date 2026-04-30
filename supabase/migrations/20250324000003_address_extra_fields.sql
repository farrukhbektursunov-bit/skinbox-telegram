-- Uy raqami, xona raqami, kirish paroli va yetkazib berish ko'rsatmasini qo'shish
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS building_number text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS apartment_number text;
-- Maxfiy kod/parol saqlanmaydi; faqat nozik bo'lmagan kirish izohi
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS entrance_note text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS delivery_instruction text;

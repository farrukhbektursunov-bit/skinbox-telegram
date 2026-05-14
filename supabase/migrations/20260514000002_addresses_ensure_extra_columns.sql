-- Agar eski bazada 20250324000003 qo'llanmagan bo'lsa:
-- "Could not find the 'entrance_note' column of 'addresses' in the schema cache"
-- (idempotent — mavjud ustunlarni qayta yaratmaydi)
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS building_number text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS apartment_number text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS entrance_note text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS delivery_instruction text;

-- PostgREST sxema keshini yangilash (Supabase)
NOTIFY pgrst, 'reload schema';

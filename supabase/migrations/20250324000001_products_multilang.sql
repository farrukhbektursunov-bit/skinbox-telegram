-- Add multilingual columns for product name and description
-- Run in Supabase SQL Editor. Existing name/description = Uzbek. Add EN/RU for other languages.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS name_en text,
ADD COLUMN IF NOT EXISTS name_ru text,
ADD COLUMN IF NOT EXISTS description_en text,
ADD COLUMN IF NOT EXISTS description_ru text;

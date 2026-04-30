-- Add sale_price for products on sale (chegirma)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price numeric;

-- Add expiry, CVC and card password columns to payment_methods
-- Run this in Supabase SQL Editor if you don't use migrations

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS expiry_month integer,
ADD COLUMN IF NOT EXISTS expiry_year integer,
ADD COLUMN IF NOT EXISTS cvc text,
ADD COLUMN IF NOT EXISTS card_password text;

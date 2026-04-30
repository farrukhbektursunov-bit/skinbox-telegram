# Supabase migrations

Run these SQL files in Supabase Dashboard → SQL Editor:

1. **20250324000000_add_card_fields.sql** – adds `expiry_month`, `expiry_year`, `cvc`, `card_password` to `payment_methods`
2. **20250324000001_products_multilang.sql** – adds `name_en`, `name_ru`, `description_en`, `description_ru` to `products` for multilingual support

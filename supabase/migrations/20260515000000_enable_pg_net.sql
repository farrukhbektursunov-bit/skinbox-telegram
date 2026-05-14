-- Database Webhook / trigger HTTP chaqiruvlari (masalan, Telegram `notify-telegram`) uchun `net` sxemasi.
-- Xato: schema "net" does not exist — `pg_net` yoqilmagan.
-- Supabase: Dashboard → Database → Extensions → "pg_net" ni yoqing yoki shu faylni migratsiya sifatida ishga tushiring.

create extension if not exists pg_net;

comment on extension pg_net is
  'HTTP so''rovlari (net.http_post va hokazo). Database Webhook lar uchun kerak bo''lishi mumkin.';

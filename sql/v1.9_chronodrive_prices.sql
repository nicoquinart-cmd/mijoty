-- Mijoty V1.9 — Prix Chronodrive sur la liste de courses
alter table public.shopping_list_items
  add column if not exists retailer_name text,
  add column if not exists retailer_product_name text,
  add column if not exists retailer_package text,
  add column if not exists retailer_price numeric(10,2),
  add column if not exists retailer_price_per_unit text,
  add column if not exists retailer_url text,
  add column if not exists retailer_confidence numeric(4,3),
  add column if not exists retailer_checked_at timestamptz;

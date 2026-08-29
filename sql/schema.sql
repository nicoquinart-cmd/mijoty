-- Mijoty V1 — Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon foyer',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  member_type text not null default 'adult' check(member_type in ('adult','teen','child','guest')),
  portion_factor numeric(4,2) not null default 1,
  kcal_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_start date not null,
  amount numeric(10,2) not null check(amount >= 0),
  unique(household_id, month_start)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_date date not null default current_date,
  store_name text,
  amount numeric(10,2) not null check(amount >= 0),
  category text not null default 'groceries',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  category text,
  default_unit text,
  created_at timestamptz not null default now()
);

create unique index if not exists products_barcode_uidx on public.products(barcode) where barcode is not null;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid references public.products(id),
  custom_name text,
  quantity numeric(10,2) not null default 1,
  unit text,
  location text not null default 'pantry' check(location in ('fridge','freezer','pantry','other')),
  expiry_date date,
  low_stock_threshold numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(product_id is not null or custom_name is not null)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  title text not null,
  default_portions integer not null default 4,
  kcal_per_portion integer,
  estimated_cost numeric(10,2),
  prep_minutes integer,
  instructions text,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id uuid references public.products(id),
  ingredient_name text not null,
  quantity numeric(10,2),
  unit text
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  meal_type text not null default 'dinner' check(meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  portions numeric(6,2) not null default 4,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Courses',
  status text not null default 'open' check(status in ('open','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid references public.products(id),
  item_name text not null,
  quantity numeric(10,2) default 1,
  unit text,
  estimated_price numeric(10,2),
  checked boolean not null default false
);

create table if not exists public.food_preferences (
  id uuid primary key default gen_random_uuid(),
  household_member_id uuid not null references public.household_members(id) on delete cascade,
  item_name text not null,
  preference text not null check(preference in ('love','like','neutral','dislike','never','allergy')),
  unique(household_member_id,item_name)
);

-- Helper function: household access
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = hid and hm.user_id = auth.uid()
  ) or exists (
    select 1 from public.households h
    where h.id = hid and h.created_by = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.food_preferences enable row level security;

create policy "profiles own" on public.profiles for all using(id=auth.uid()) with check(id=auth.uid());
create policy "households visible" on public.households for select using(public.is_household_member(id));
create policy "households create" on public.households for insert with check(created_by=auth.uid());
create policy "households update" on public.households for update using(public.is_household_member(id));
create policy "members household" on public.household_members for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "budgets household" on public.budgets for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "expenses household" on public.expenses for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "inventory household" on public.inventory_items for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "recipes household" on public.recipes for all using(household_id is null or public.is_household_member(household_id)) with check(household_id is null or public.is_household_member(household_id));
create policy "meals household" on public.meal_plans for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "lists household" on public.shopping_lists for all using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create policy "list items household" on public.shopping_list_items for all using(exists(select 1 from public.shopping_lists sl where sl.id=shopping_list_id and public.is_household_member(sl.household_id))) with check(exists(select 1 from public.shopping_lists sl where sl.id=shopping_list_id and public.is_household_member(sl.household_id)));
create policy "prefs household" on public.food_preferences for all using(exists(select 1 from public.household_members hm where hm.id=household_member_id and public.is_household_member(hm.household_id))) with check(exists(select 1 from public.household_members hm where hm.id=household_member_id and public.is_household_member(hm.household_id)));

-- Products are a shared catalogue, read-only from the app in V1.
alter table public.products enable row level security;
create policy "products readable" on public.products for select using(auth.uid() is not null);

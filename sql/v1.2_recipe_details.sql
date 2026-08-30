-- Mijoty V1.2 — ingrédients + préparation pas à pas
-- À exécuter UNE FOIS dans Supabase > SQL Editor avant d'utiliser la V1.2.

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number integer not null check(step_number > 0),
  instruction text not null,
  duration_minutes integer check(duration_minutes is null or duration_minutes >= 0),
  created_at timestamptz not null default now(),
  unique(recipe_id, step_number)
);

-- Sécurise les ingrédients existants.
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

-- Rejouable : supprime d'abord les politiques V1.2 si elles existent déjà.
drop policy if exists "recipe ingredients read" on public.recipe_ingredients;
drop policy if exists "recipe ingredients write" on public.recipe_ingredients;
drop policy if exists "recipe steps read" on public.recipe_steps;
drop policy if exists "recipe steps write" on public.recipe_steps;

create policy "recipe ingredients read"
on public.recipe_ingredients for select
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and (r.household_id is null or public.is_household_member(r.household_id))
  )
);

create policy "recipe ingredients write"
on public.recipe_ingredients for all
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and r.household_id is not null
      and public.is_household_member(r.household_id)
  )
)
with check (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and r.household_id is not null
      and public.is_household_member(r.household_id)
  )
);

create policy "recipe steps read"
on public.recipe_steps for select
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and (r.household_id is null or public.is_household_member(r.household_id))
  )
);

create policy "recipe steps write"
on public.recipe_steps for all
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and r.household_id is not null
      and public.is_household_member(r.household_id)
  )
)
with check (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_id
      and r.household_id is not null
      and public.is_household_member(r.household_id)
  )
);

-- Mijoty V1.3 — propositions automatiques de courses
-- Les articles manquants issus des recettes planifiées sont créés comme propositions.
-- L'utilisateur doit les accepter ou les refuser avant qu'ils rejoignent la liste réelle.

alter table public.shopping_list_items
  add column if not exists proposal_status text not null default 'accepted';

alter table public.shopping_list_items
  add column if not exists source_key text;

alter table public.shopping_list_items
  add column if not exists source_label text;

-- Ajout de la contrainte sans casser une base déjà migrée.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_list_items_proposal_status_check'
  ) then
    alter table public.shopping_list_items
      add constraint shopping_list_items_proposal_status_check
      check (proposal_status in ('pending','accepted','rejected'));
  end if;
end $$;

create unique index if not exists shopping_list_items_source_key_uidx
  on public.shopping_list_items(shopping_list_id, source_key)
  where source_key is not null;

-- Les anciennes lignes restent de vrais articles validés.
update public.shopping_list_items
set proposal_status = 'accepted'
where proposal_status is null;

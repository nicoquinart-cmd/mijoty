# Mijoty V1.2

V1.2 connectée à Supabase avec recettes détaillées.

## Nouveautés V1.2
- création d'une recette avec ses ingrédients, quantités et unités ;
- ajout/suppression d'ingrédients sur une recette existante ;
- création des étapes de préparation dans l'ordre ;
- durée facultative par étape ;
- affichage détaillé d'une recette ;
- mode cuisine « pas à pas » avec étape précédente / suivante ;
- ingrédients et étapes stockés dans Supabase.

## Important avant déploiement
Dans Supabase > SQL Editor, exécuter une fois :

`sql/v1.2_recipe_details.sql`

Cette migration crée `recipe_steps` et ajoute les règles RLS nécessaires à `recipe_ingredients` et `recipe_steps`.

## Vercel
Variables d'environnement requises :
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Build command : `npm run build:web`
Output directory : `dist`

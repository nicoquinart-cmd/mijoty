# Mijoty V1.3

V1.3 ajoute les **propositions automatiques de courses à valider**.

## Nouveautés

- Analyse des recettes planifiées sur les 14 prochains jours.
- Comparaison des quantités nécessaires avec le stock du foyer.
- Calcul de la quantité manquante par ingrédient.
- Création automatique d'une proposition dans l'onglet **Courses**.
- Une proposition est séparée de la vraie liste tant que l'utilisateur n'a pas choisi :
  - **Accepter** : l'article rejoint la liste de courses.
  - **Refuser** : l'article est écarté et ne revient pas au prochain recalcul de la même liste.
- Bouton **Actualiser les propositions** pour relancer l'analyse.
- Les articles ajoutés manuellement restent directement validés.

## Mise à jour Supabase obligatoire

Avant de publier cette version, exécuter dans Supabase SQL Editor :

`sql/v1.3_shopping_suggestions.sql`

Cette migration ajoute à `shopping_list_items` :

- `proposal_status`
- `source_key`
- `source_label`

Les anciens articles sont conservés comme articles validés.

## Logique de calcul

Mijoty additionne les besoins des recettes planifiées en tenant compte du nombre de portions, puis soustrait les quantités disponibles dans `inventory_items`. Les articles déjà validés dans la liste de courses sont également pris en compte pour éviter les doublons.

Mijoty rapproche les unités courantes et convertit automatiquement **g ↔ kg** ainsi que **ml ↔ l** pour comparer correctement le besoin de la recette au stock. Les unités de type pièce/unité sont aussi normalisées.

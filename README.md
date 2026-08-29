# Mijoty V1

Application mobile Expo / React Native / TypeScript centrée sur le pilotage du budget courses du foyer.

## Fonctionnel dans cette V1
- Navigation : Accueil / Repas / Stock / Courses / Plus
- Dashboard budget avec dépenses, restant, prévision et indicateurs semaine
- Planning repas avec portions, kcal/portion et coût/portion
- Stock avec emplacement, quantité, péremption et stock faible
- Liste de courses interactive avec panier estimé
- Paramètres foyer / préférences / portions / nutrition
- Client Supabase prêt à configurer
- Schéma PostgreSQL Supabase + RLS par foyer
- Mode démonstration sans Supabase pour visualiser immédiatement l'UI

## Démarrer
1. Installer Node.js LTS.
2. Dans ce dossier : `npm install`
3. Copier `.env.example` vers `.env`.
4. Renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Dans Supabase > SQL Editor, exécuter `sql/schema.sql`.
6. Lancer : `npm start`
7. Scanner le QR code avec Expo Go, ou ouvrir Android/iOS/Web.

## Important
Cette V1 montre les écrans et pose le modèle de données. Les écrans utilisent encore des données de démonstration. La prochaine itération doit brancher les CRUD Supabase, puis ajouter l'authentification et l'onboarding foyer.

## Sécurité
Les données métier sont rattachées à `household_id`. Les policies RLS limitent l'accès aux membres du foyer. Ne jamais intégrer une `service_role` key dans l'application mobile.

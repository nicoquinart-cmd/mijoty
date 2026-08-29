# Mijoty V1.1

V1.1 connectée à Supabase.

Fonctions actives :
- authentification e-mail / mot de passe ;
- création automatique d'un foyer pour un nouvel utilisateur ;
- budget réel et ajout de dépenses ;
- stock réel avec ajout/suppression ;
- liste de courses réelle, ajout et coche ;
- recettes réelles et planning de 7 dîners ;
- affichage du foyer et déconnexion.

## Vercel
Variables d'environnement requises :
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Build command : `npm run build:web`
Output directory : `dist`

Le schéma SQL V1 existant suffit : aucune migration supplémentaire n'est nécessaire.

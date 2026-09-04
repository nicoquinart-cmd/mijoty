# Mijoty V1.5 — Scan intelligent

Cette version améliore fortement l'entrée de stock par photo et ticket.

## Produit
- photo ou import depuis la photothèque ;
- détection du code-barres ;
- recherche d'abord dans le catalogue Supabase ;
- si inconnu, enrichissement via Open Food Facts (nom, marque, quantité, unité, catégorie) ;
- OCR de l'emballage en solution de repli ;
- validation humaine obligatoire avant ajout.

## Ticket de caisse
- OCR français dans le navigateur ;
- extraction des lignes produits ;
- détection du prix par ligne quand il est lisible ;
- tentative de détection de l'enseigne, de la date et du total ;
- écran de validation/correction ;
- ajout groupé au stock ;
- le total validé est aussi ajouté automatiquement aux dépenses du budget courses.

## Déploiement
Aucune migration SQL supplémentaire n'est nécessaire par rapport à V1.4. Remplacer le contenu du dépôt GitHub par cette version puis laisser Vercel redéployer.

Les variables Supabase restent identiques.

## V1.7
- Recherche Open Food Facts par texte lorsque le code-barres n'est pas détecté ou n'existe pas dans le catalogue.
- Meilleure reconnaissance des bouteilles et emballages réfléchissants/courbes.
- La recherche texte utilise le nom OCR, la marque et la quantité comme signaux, avec validation utilisateur obligatoire.


## V1.8 – Scanner code-barres en direct
- Scanner caméra en direct (web/PWA) basé sur ZXing.
- Caméra arrière privilégiée.
- Recherche prioritaire dans le catalogue Mijoty, puis Open Food Facts.
- Fiche produit à valider avant ajout au stock.
- Saisie manuelle EAN/UPC de secours.
- Le scan ticket reste disponible.

## V1.9 – Prix Chronodrive dans la liste de courses
- À l'ajout manuel d'un article, Mijoty recherche automatiquement le produit correspondant sur Chronodrive.
- Lorsqu'une proposition issue d'une recette est acceptée, son prix Chronodrive est également recherché.
- Affichage du produit/format correspondant, du prix, du prix au kg/L quand disponible, de la date de vérification et d'un lien vers Chronodrive.
- Le total estimé de la liste utilise le prix Chronodrive trouvé.
- Si aucune correspondance suffisamment fiable n'est trouvée, Mijoty n'invente pas de prix et conserve un prix manuel éventuel.

### Installation V1.9
1. Exécuter `sql/v1.9_chronodrive_prices.sql` dans Supabase SQL Editor.
3. Redéployer sur Vercel.

La recherche de prix utilise le web search de l'API OpenAI limité au domaine `chronodrive.com`. Cela évite d'exposer la clé API dans l'application cliente et permet de vérifier les pages produits publiques au moment de l'ajout.


## V1.10 – Sans API payante + icône mobile
- Suppression complète de `OPENAI_API_KEY` et de l'appel OpenAI de la V1.9.
- Recherche Chronodrive gratuite : Mijoty cherche des pages produit Chronodrive publiquement accessibles, lit leur prix et n'enregistre un prix que si la correspondance est suffisamment fiable.
- En cas d'échec, l'article est ajouté avec « Prix Chronodrive non vérifié » : aucun prix n'est inventé.
- Ajout du logo Mijoty comme icône Expo/PWA, icône Android adaptative et favicon web.
- Version visible : v1.10.

### Déploiement V1.10
1. Remplacer le dépôt GitHub par cette version.
2. Aucun `OPENAI_API_KEY` n'est nécessaire dans Vercel ; si vous l'aviez créée uniquement pour Mijoty, vous pouvez la supprimer.
3. Si le SQL V1.9 n'a jamais été exécuté, exécuter `sql/v1.9_chronodrive_prices.sql` dans Supabase (les colonnes prix Chronodrive restent utilisées).
4. Laisser Vercel redéployer.
5. Sur mobile, supprimer puis réinstaller le raccourci/PWA si l'ancienne icône reste en cache.

> Note : Chronodrive ne fournit pas ici d'API publique de prix utilisée par Mijoty. La récupération gratuite repose sur les pages publiques du site et peut donc cesser de fonctionner si Chronodrive modifie son site ou bloque les requêtes automatisées.

## V1.11 — Correctif icône mobile / PWA

- Ajout d'un `manifest.webmanifest` explicite pour l'installation Android/PWA.
- Icônes dédiées 192×192 et 512×512.
- Icône Android `maskable` avec zone de sécurité.
- `apple-touch-icon` 180×180 pour iPhone/iPad.
- Favicon web dédié.
- Métadonnées PWA injectées via `app/+html.tsx`.
- Version affichée : v1.11.

Après déploiement, supprimer l'ancien raccourci Mijoty du téléphone, fermer/réouvrir le navigateur puis recréer le raccourci. Android peut conserver l'ancienne icône en cache tant que l'ancien raccourci existe.

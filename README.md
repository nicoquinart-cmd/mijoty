# Mijoty V1.4

V1.4 ajoute l'entrée de stock par photo, tout en conservant la validation humaine avant écriture dans Supabase.

## Nouveautés

### Photo d'un article
- prise de photo ou import depuis la photothèque ;
- tentative de détection du code-barres ;
- OCR de l'étiquette pour préremplir le nom ;
- si le code-barres existe déjà dans `products`, le nom catalogue est utilisé ;
- correction du nom, de la quantité et de l'unité avant validation ;
- aucune création automatique sans validation.

### Photo d'un ticket de caisse
- prise de photo ou import ;
- OCR exécuté dans le navigateur ;
- extraction de lignes ressemblant à des produits ;
- écran de contrôle permettant de modifier ou retirer chaque ligne ;
- ajout groupé au stock après validation.

## Technique
- `expo-image-picker` : caméra / photothèque ;
- `tesseract.js` : OCR français dans le navigateur ;
- `@zxing/browser` : lecture de codes-barres ;
- aucune clé d'IA/OCR tierce nécessaire ;
- aucune migration SQL nécessaire pour cette version.

## Limites connues
L'OCR d'un ticket dépend fortement de la qualité de la photo et de la mise en page du magasin. Le système est volontairement conçu comme une **pré-saisie à valider**, et non comme un ajout automatique au stock. La reconnaissance d'un emballage sans code-barres repose sur le texte visible sur la photo.

## Déploiement
Remplacer les fichiers du dépôt GitHub par ceux de cette version et laisser Vercel redéployer. Les variables Supabase existantes restent inchangées.

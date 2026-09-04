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

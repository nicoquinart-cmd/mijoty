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

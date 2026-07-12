# Feuille de route SEO — DatacenterMarket

*Objectif exprimé : référencement France, Europe (souveraineté) et, si possible, monde.*

> **Note d'honnêteté.** Aucun classement ne se garantit : Google arbitre selon la qualité/profondeur
> du contenu, les **backlinks et l'autorité de domaine**, la concurrence et le **temps** (des mois).
> Ce qui suit maximise les chances ; ça ne promet pas une position. **Top 3 réaliste** sur des requêtes
> de niche FR/UE-souveraineté (« location GPU souverain France », « GPU as a service RGPD Europe »).
> **Top 3 improbable** à court terme sur les requêtes génériques mondiales (« GPU cloud », « rent H100 »)
> face aux hyperscalers et acteurs établis, avec un domaine neuf.

## Phase 1 — Technique FR « sans regret » (FAIT — cette PR)

- **hreflang** : `fr-FR` + `x-default` auto-référents sur chaque page (`SeoManager`). Base propre pour
  ajouter `/en` en phase 2 sans retoucher l'architecture.
- **Données structurées enrichies** : nouveau schéma `WebSite` (accueil) ; `Organization` complété
  (`logo`, `description`, `areaServed` FR/BE/LU/CH/EU, `sameAs`). S'ajoutent aux `Service`, `FAQPage`,
  `BreadcrumbList` déjà en place.
- **Open Graph / Twitter** : `og:image` + `twitter:image` (carte `summary_large_image`) via une image
  de couverture de marque (`/og-cover.svg`) — aperçus sociaux enfin présents.
- **Favicon** : ajout d'un favicon SVG de marque (il n'y en avait aucun) + `theme-color`.

*Déjà solide avant cette PR : prérendu au build, `sitemap.xml`/`robots.txt`, canoniques, fonts
auto-hébergées, page pilier `/gpu-as-a-service/` + satellites, contenu FR ciblé souveraineté/RGPD.*

### Suivi recommandé en phase 1 (léger, à faire quand vous voulez)
- **Rendu PNG/JPG 1200×630** de la couverture OG (le SVG n'est pas rendu par tous les réseaux) —
  remplacer `/og-cover.svg` ou surcharger via le champ `ogImage` d'une route. Idem `Organization.logo`
  en PNG pour le *logo rich result* Google.
- Étoffer la profondeur éditoriale des satellites (chaque page = 1 intention de recherche précise).

## Phase 2 — International : version anglaise + hreflang (À PLANIFIER)

C'est **le** levier pour l'Europe non-francophone et le monde (tes datacenters phares sont à Francfort
et Amsterdam — recherche en anglais).

- Version **`/en`** du contenu indexable (accueil, pilier, satellites, mentions légales EN).
- `hreflang` complet : `fr-FR`, `en`, `x-default` croisés entre les deux versions.
- Ciblage requêtes anglophones : *sovereign GPU cloud Europe*, *rent H100 Europe*, *GDPR GPU hosting*.
- **À valider avant de lancer :** la traduction devra être **relue par toi** (conseil juridique — le
  contenu FR est précis et engageant la responsabilité) ; et le double jeu de contenu double la
  maintenance éditoriale.

## Hors code — indispensable et déterminant (tes actions)

Ces leviers pèsent souvent **plus** que la technique :
1. **Google Search Console** + **Bing Webmaster Tools** : vérifier le domaine, soumettre le sitemap,
   suivre l'indexation et les requêtes réelles. *À faire en premier après mise en ligne.*
2. **Domaine canonique** : figer `datacentermarket.fr` (à valider) et le renseigner en `VITE_SITE_URL`
   au build (pilote canoniques, sitemap, OG).
3. **Backlinks / autorité** : citations presse/annuaire tech, partenariats fournisseurs, profil
   d'entreprise (Anavim), communiqués. C'est le facteur n°1 hors-page pour un domaine neuf.
4. **Google Business Profile** (entité Anavim Advisory, Paris) — signal local France.
5. **Cadence de contenu** : publier régulièrement sur les intentions ciblées (guides, comparatifs,
   cas d'usage souveraineté) ; la fraîcheur et la couverture sémantique comptent.
6. **Cœur web vitaux** : activer gzip/brotli au reverse proxy (cf. `DEPLOYMENT.md §14`) — la
   performance mobile est un signal.

## En résumé
Phase 1 (technique FR) est livrée et sûre. L'Europe/monde passe par la phase 2 (anglais) — décision et
contenu à cadrer ensemble — et surtout par les actions hors-code ci-dessus, que le code ne peut pas
remplacer.

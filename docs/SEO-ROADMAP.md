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

## Phase 2 — International : version anglaise + hreflang (FONDATION LIVRÉE)

Levier principal pour l'Europe non-francophone et le monde (datacenters phares à Francfort/Amsterdam —
recherche en anglais). **Livré dans cette itération :**

- **Infrastructure i18n** : `RouteSeo` porte `lang` + un cluster `hreflang` réciproque ; `SeoManager`
  (runtime) **et** `scripts/prerender.ts` (build) émettent `<html lang>`, les `hreflang` croisés
  (`fr-FR` / `en` / `x-default`) et `og:locale` par langue.
- **Landing anglaise `/en`** (`client/src/pages/LandingEn.tsx`) : page indexable, **prérendue**,
  contenu natif anglais (hero, how-it-works, catalogue, souveraineté/RGPD, FAQ) + JSON-LD anglais
  (`WebSite`, `Service`, `FAQPage`).
- **hreflang croisés** `/` ↔ `/en/` (réciproques) ; `/en/` ajoutée au `sitemap.xml`.
- **Sélecteur de langue** FR/EN dans les en-têtes.
- Ciblage : *GPU as a service Europe*, *rent H100 Europe*, *sovereign GPU EU*, *GDPR GPU hosting*.

**Reste à faire (itérations suivantes — contenu à faire relire par toi) :**
- Versions EN du **pilier** (`/en/gpu-as-a-service`) et des **satellites** (prix, souveraineté) :
  l'infra hreflang est prête — ajouter les pages + les entrées `SEO_ROUTES` avec leur cluster.
- **Mentions légales EN** — relecture juridique indispensable (Anavim est un conseil).
- **Localisation du tunnel** (`/workload` → checkout) : aujourd'hui le CTA « Request capacity » de la
  landing EN mène au formulaire **français**.

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

## Positionnement éditorial (décision du 13 juillet 2026)

**Axe unique : DatacenterMarket est LA plateforme qui centralise les offres GPU as a Service du
marché.** Tout contenu SEO (title, description, H1, JSON-LD, FAQ, netlinking) attaque par la
centralisation/comparaison — jamais par la location en propre (nous ne sommes pas un fournisseur).

- Requêtes visées en priorité : « comparateur GPU cloud », « comparer offres GPU as a service »,
  « prix GPU comparés », « marketplace GPU Europe », « appel au marché GPU ».
- Vocabulaire canon : « centralise les offres », « tout le marché, un seul appel », « offres
  normalisées (prix, délai, SLA, localisation) », « mise en concurrence ».
- Le JSON-LD Service est typé « Centralisation et comparaison d'offres » ; la FAQ ouvre sur
  « Pourquoi comparer via une place de marché ? » (FR + EN).
- Prochains contenus à créer dans cet axe : page « Comparatif des fournisseurs GPU cloud
  en Europe » (tableau normalisé), page « Comment fonctionne l'appel au marché », pages
  par gamme (« comparer les offres H100 »).

### Cluster « capacité datacenter hors GPU » (ouvert le 13 juillet 2026)

Paire /colocation-datacenter/ (FR) ↔ /en/datacenter-colocation/ (EN), niveau racine (pas sous
/gpu-as-a-service/). Requêtes : « colocation datacenter », « location baie datacenter »,
« location capacité datacenter », « datacenter colocation ». Règle de véracité : la colocation
n'est PAS au catalogue standard — toujours formuler « mobilisée via l'appel au marché auprès des
opérateurs partenaires ». Extensions possibles : satellites « colocation haute densité IA »,
« prix colocation au kW », pilier dédié si le segment prend.

# Audit de l'état du site — DatacenterMarket

*Date : 2026-08-22 · Cible : `main` @ `0d7448a` · Périmètre : code, chaîne de livraison, déploiement réel, état commercial.*
*Méthode : lecture du dépôt + exécution réelle de la chaîne (`install`/`check`/`test`/`build`/smoke) + sondes HTTP/DNS sur le domaine + relevé GitHub (PR, CI, crons). Les commandes et leurs sorties sont en annexe.*

---

## Verdict

**Le produit est terminé, la mise en ligne n'existe pas.** `main` est sain — 250 tests verts, `tsc` clean,
build et prérendu OK, invariants métier en place — mais `datacentermarket.fr` sert toujours la page de
parking « Site en construction » d'OVHcloud, sans HTTPS. Aucune instance de l'application n'est joignable.

**Trois choses bloquent, et aucune n'est un bug.** (1) Un chantier de durcissement production de 5 400
lignes dort dans la PR #30 depuis 16 jours ; (2) le catalogue est vide *par conception* — les seuls
fournisseurs en base sont fictifs et désactivés, donc même déployé le tunnel ne peut rien vendre ;
(3) le domaine, l'hébergement et l'activation Stripe attendent des décisions, pas du code.

**Un point de vigilance immédiat** : la base de données de production, elle, est bien vivante et
**joignable depuis les runners GitHub** d'un dépôt public, alors qu'aucune application ne l'utilise.

---

## 1. Ce qui tourne réellement aujourd'hui

| Élément | État constaté | Preuve |
|---|---|---|
| **Domaine public** | ❌ **Page de parking OVHcloud** « Site en construction » en HTTP 200 ; **port 443 reset la connexion** (aucun TLS). `datacentermarket.fr` et `www.` → `213.186.33.5`. | `curl` §Annexe A |
| **Application déployée** | ❌ Aucune. Rien sur le nom du blueprint Render (`datacenter-market`), rien derrière le domaine. | `render.yaml:14`, sonde §A |
| **Base de données** | ✅ **Vivante et joignable depuis GitHub Actions.** | crons verts, cf. ci-dessous |
| **Crons RGPD** | ✅ 909 exécutions, **toutes vertes**, dernière le 22/08 à 18:58 UTC (horaire). | `.github/workflows/crons.yml` |
| **CI `main`** | ✅ Verte au dernier push (21/07, run #70). Revérifiée localement ce jour, cf. §2. | `.github/workflows/ci.yml` |
| **Dernier commit `main`** | ⚠️ `0d7448a`, **22 juillet 2026** — 31 jours sans merge. | `git log` |
| **PR ouvertes** | ⚠️ **1 draft bloquée** (#30, cf. §3.1). | GitHub |
| **Issues ouvertes** | ✅ Aucune. | GitHub |

**Le point le plus important de ce tableau est le croisement des lignes 3 et 1.** `pnpm db:cancel-stale`
appelle `cancelStalePendingOrders`, qui lève `Database not available` en l'absence de `DATABASE_URL`
(`server/db.ts:1057-1059`). Le job réussit toutes les heures : le secret `DATABASE_URL` est donc bien
renseigné et la base **accepte les connexions depuis les runners GitHub hébergés** (plages d'IP publiques
très larges). C'est exactement le risque documenté en tête de `.github/workflows/crons.yml:4-12`, sur un
dépôt qui est par ailleurs **public**. Une base de production ouverte, avec un credential long terme et
destructif (`db:purge` supprime définitivement des leads), pour servir une application qui n'existe pas
encore en ligne : le rapport bénéfice/risque est aujourd'hui défavorable.

## 2. État du code — sain

Vérifié par exécution ce jour sur `0d7448a` (sorties complètes en §Annexe B) :

- `pnpm check` → **clean** (aucune erreur TypeScript).
- `pnpm test` → **250 tests / 27 fichiers, 100 % verts** en 6 s.
- `pnpm build` → **OK** : bundle client, `sitemap.xml` (15 URL), `robots.txt`, **15 routes prérendues**,
  `dist/index.js` (144 ko) et `dist/db-preflight.js` (10,5 ko).
- **Smoke du bundle de production** (sans `DATABASE_URL`) → `/health` **200** `{"status":"ok"}` ;
  `/ready` **503** avec le détail honnête `{"database":"unavailable","redis":"disabled","stripe":"disabled"}` ;
  `/`, `/en/`, `/gpu-as-a-service/`, `/robots.txt`, `/sitemap.xml` tous **200**, titres FR et EN corrects
  dans le HTML prérendu. La séparation liveness (`/health`) / readiness (`/ready`) fonctionne comme
  documentée dans `render.yaml:20-22`.

**Périmètre fonctionnel livré** : 8 tables (`drizzle/schema.ts`), ~27 procédures tRPC, 25 routes client.
Funnel complet lead → matching → offre → checkout Stripe → provisionnement → dashboards client et admin,
plus back-office fournisseurs/inventaire, flux SSE de provisionnement, notifications e-mail, télémétrie
et alertes, export CSV, preflight de migration. Cluster SEO FR/EN complet avec hreflang réciproques.
Aucun `TODO`/`FIXME`/`HACK` dans le code applicatif.

**Invariants métier revérifiés dans le code actuel** — tous tenus :

| Invariant | Vérification |
|---|---|
| Prix calculé côté serveur | `routers.ts:149-151` — montants dérivés de l'offre en base, jamais de l'entrée client |
| Webhook Stripe = source de vérité | `stripe.ts:380` — `payment_status` lu explicitement ; journal d'événements pour l'idempotence (`stripe.ts:539-547`) ; 8 types d'événements traités, y compris les paiements différés et les annulations d'abonnement |
| Cycle de vie du lead | `offered` au checkout, `converted` seulement sur paiement (`stripe.ts:405`, `:448`) |
| Revendication de lead anonyme | jeton signé exigé (`routers.ts:139`) — le correctif HIGH #1 de juillet est bien en place |
| Catalogue fail-closed | `getOffer(..., { sellableOnly: true })` au checkout (`routers.ts:117`) |
| Écritures sensibles admin-only | `adminProcedure` sur les 13 procédures admin, dont les 8 écritures métier |

## 3. Écarts bloquant la mise en ligne

### 3.1 — 🔴 PR #30 bloquée depuis 16 jours (5 412 lignes de durcissement production)

[« Harden marketplace production readiness »](https://github.com/charlesmamane26-sketch/datacenter-market-v1/pull/30),
draft ouverte le **6 août**, 68 fichiers, **+5 412/−797**, base à jour sur `main`. Contenu annoncé :
réservations d'inventaire atomiques et réversibles, sémantique terminale d'annulation Stripe, durcissement
JWT/session/SSE/proxy de stockage/clés de télémétrie, arrêt gracieux, migration `0007` avec preflight de
clés étrangères, **mise à jour des dépendances vulnérables**, contrôles d'audit et de dérive en CI.

**Elle n'est pas rouge, elle est en suspens** : la dernière CI (run `31123737241`) est **`cancelled`**
après 15 minutes, sans qu'un run plus récent l'ait remplacée ; le commit précédent était vert. Il ne s'agit
donc pas d'un échec de test à corriger, mais d'un run à relancer puis d'une revue à mener.

*Conséquence directe, mesurée ce jour* : `pnpm audit --prod` sur `main` remonte **18 vulnérabilités
(2 hautes, 14 moyennes, 2 basses)**, là où la PR #30 annonce 0. Analyse d'exposition réelle :

| Paquet | Sévérité | Où il est utilisé | Exposition réelle |
|---|---|---|---|
| `axios` | **1 haute** + 9 moyennes | `server/_core/sdk.ts` uniquement | Réelle mais confinée à la plomberie SDK Manus côté serveur |
| `nanoid` | **1 haute** | `server/_core/vite.ts` uniquement | Quasi nulle : chemin de dev (HMR), pas dans le serveur de production |
| `mermaid` + `dompurify` | 5 moyennes/basses | `streamdown` → `AIChatBox` → `ComponentShowcase` | **Nulle** : `ComponentShowcase` n'est routée nulle part dans `App.tsx` ; vérifié — `mermaid` **n'est pas** dans le bundle construit (tree-shaké) |
| `body-parser` | 1 basse | via `express` | Faible |

→ Le compte de 18 est trompeur ; le sujet réel se réduit à **`axios` côté serveur**. Mais il ne se règle
qu'en débloquant #30 (ou en en extrayant la montée de version).

**Action** : relancer la CI de #30, la revoir, la merger ou la fermer explicitement. Laisser 5 400 lignes
de durcissement en draft indéfiniment est le pire des trois états.

### 3.2 — 🔴 Le catalogue est vide par conception : rien n'est vendable

`server/seed.ts:16-21` insère **4 fournisseurs fictifs** — *Central Europe Compute*, *Hexagone Accelerated*,
*North Sea Compute*, *Iberia GPU Cloud* — tous en `isActive: false`, et le fichier le dit franchement :
« *Supplier names and prices are demo catalogue data, not verified commercial inventory* ».

La lecture publique est **fail-closed** (`server/inventory.ts:21-32`) : une offre n'est vendable que si
elle est active **et** son fournisseur actif **et** son statut de disponibilité vendable **et** sa capacité
> 0 **et** son `availabilityExpiresAt` dans le futur. `getAllOffers` (`server/db.ts:265-278`) applique ce
filtre à la liste publique comme au matching.

→ **En l'état, `offers.list` renvoie une liste vide et le tunnel n'a rien à proposer.** L'UX dégradée
existe et est propre (`ResultsScreen.tsx:137`, « Aucune option disponible »), le comportement est donc sûr
— mais commercialement inerte.

C'est une bonne conception (aucune offre inventée ne peut être vendue), et c'est aussi le **vrai
prérequis au lancement** : il faut au moins un fournisseur réel, contractualisé, saisi et activé dans le
back-office avec une date de fraîcheur, avant que la mise en ligne ait un sens. Ce travail est commercial,
pas technique.

### 3.3 — 🟠 Base de production exposée aux runners GitHub, dépôt public

Cf. §1. Trois options, par ordre de préférence :

1. **Si aucune donnée client n'existe encore** (probable, l'app n'a jamais été en ligne) : retirer le
   secret `DATABASE_URL` des Actions et désactiver le workflow de crons jusqu'à la mise en ligne réelle.
   Les crons RGPD n'ont rien à purger tant qu'il n'y a pas de leads.
2. Restreindre l'ingress de la base aux plages d'IP publiées des runners GitHub et limiter le credential
   aux seules tables touchées par `db:purge`/`db:cancel-stale`.
3. Déplacer ces crons dans le réseau de l'hébergement une fois le déploiement fait (option déjà
   recommandée dans le fichier lui-même).

À décider aussi : le dépôt est **public**. Ce n'est pas un défaut de sécurité en soi (aucun secret n'est
commité, et GitHub n'expose pas les secrets aux PR de forks), mais cela publie le moteur de matching, la
grille tarifaire de démonstration et l'architecture complète. C'est un choix de positionnement à assumer
sciemment.

### 3.4 — 🟠 Décisions en attente qui bloquent le build de production

- **Domaine canonique non arbitré** : `shared/seo.ts:17` porte toujours `[À VALIDER]`. Or `VITE_SITE_URL`
  est **inlinée au build** et pilote canoniques, `sitemap.xml`, `robots.txt` et Open Graph. Se tromper de
  domaine impose un rebuild complet — et un changement après indexation coûte du référencement.
- **Hébergement non tranché** : `render.yaml` est explicitement un blueprint de *recette* (`plan: free`,
  « ne porte aucun engagement de production », mise en veille après 15 min). Aucune décision d'hébergement
  de production n'est actée dans le dépôt.
- **Stripe live volontairement inerte** : une clé `sk_live_` reste sans effet tant que
  `STRIPE_LIVE_PAYMENTS_ENABLED ≠ true` (`server/_core/env.ts:19`). Garde-fou sain, mais c'est un
  interrupteur qu'il faudra basculer *après* recette live.
- **L'hypothèse Stripe jamais vérifiée** subsiste : un article one-time (frais de setup) dans une session
  `mode: subscription` (DEPLOYMENT.md §10). À tester avec une offre à setup fee > 0 avant toute vente.

## 4. Écarts non bloquants

| # | Constat | Emplacement | Effort |
|---|---|---|---|
| 4.1 | **Soft 404 : toute URL inconnue renvoie HTTP 200** avec l'accueil français prérendu — `<meta robots="index,follow">` et `canonical` vers `/`. Vérifié : `/route-inexistante` renvoie 34 521 octets, **octet pour octet la page d'accueil**. Les crawlers voient donc une copie indexable de l'accueil à chaque URL erronée (soft 404 + contenu dupliqué). Le routeur client affiche bien `NotFound`, mais après coup. | `server/_core/vite.ts:64-66` | ~1 h (plomberie `_core`, extension d'infra légitime) |
| 4.2 | **Tunnel non localisé** : les pages EN sont indexables, mais le CTA « Request capacity » mène au formulaire **français**. Parcours cassé pour tout prospect anglophone acquis par le SEO EN. | `docs/SEO-ROADMAP.md` | Moyen — arbitrage produit |
| 4.3 | **Mentions légales/CGU/confidentialité absentes en anglais** — relecture juridique nécessaire (Anavim est un cabinet de conseil : l'exigence est plus forte). | — | Externe |
| 4.4 | **Télémétrie GPU sans agent** : route d'ingestion prête, aucun fournisseur ne pousse de données. Décision produit à prendre avant les premiers clients. | `server/telemetry.ts` | Décision |
| 4.5 | **Monitoring inactif** : Sentry câblé serveur + client, sans DSN. Aucune supervision d'uptime configurée. | `.env.example` | ~1 h après déploiement |
| 4.6 | **Dérive documentaire de `CLAUDE.md`** : la ligne `pnpm build` y décrit une chaîne obsolète (elle inclut désormais génération SEO, prérendu et bundle `db-preflight`), et l'arborescence omet des pans entiers livrés depuis (inventaire fournisseurs, télémétrie et alertes, flux SSE de provisionnement, notifications client, preflight DB). `AGENTS.md` en est une copie et dérivait à l'identique. Corrigés dans le même commit que cet audit. | `CLAUDE.md`, `AGENTS.md` | Fait |
| 4.7 | **`ComponentShowcase` n'est routée nulle part** : page de démonstration du template (1 400+ lignes) qui tire `streamdown`/`mermaid` dans l'arbre de dépendances pour rien. La supprimer retirerait 5 des 18 vulnérabilités remontées. | `client/src/pages/ComponentShowcase.tsx` | ~15 min |

## 5. Chemin de remise en marche

Ordre imposé par les dépendances, pas par la difficulté :

1. **Débloquer la PR #30** — relancer sa CI, revoir, merger ou fermer. Tout le reste se construit dessus,
   y compris la migration `0007` et les dépendances à jour.
2. **Trancher les décisions** — domaine canonique, hébergement de production. Sans elles, le build de
   production n'est pas fiable (`VITE_SITE_URL` est inlinée).
3. **Traiter l'exposition de la base** (§3.3), idéalement dès aujourd'hui, indépendamment du reste.
4. **Déployer en recette** — `docs/TUTO-MISE-EN-PRODUCTION.md` et `docs/RUNBOOK-DEPLOIEMENT.md` sont à
   jour et détaillés ; ils n'ont pas besoin d'être réécrits, seulement suivis.
5. **Onboarder un fournisseur réel** et l'activer dans le back-office — sans quoi le site est en ligne
   mais vide (§3.2).
6. **Stripe en test**, y compris le cas setup fee > 0 en `mode: subscription`, puis bascule live via
   `STRIPE_LIVE_PAYMENTS_ENABLED`.
7. **Observabilité** — Sentry, uptime sur `/health`, supervision séparée de `/ready`.

---

## Annexe A — Sondes réseau (22/08/2026, ~19:15 UTC)

```
$ getent hosts www.datacentermarket.fr   → 213.186.33.5
$ getent hosts datacentermarket.fr       → 213.186.33.5

$ curl https://www.datacentermarket.fr/  → curl: (35) Recv failure: Connection reset by peer
$ curl http://www.datacentermarket.fr/   → HTTP/1.1 200 OK   server: openresty
                                           <title>Site en construction</title>
                                           <meta name="Copyright" content="OVHcloud">
                                           <meta name="robots" content="none,noindex,nofollow">
```

## Annexe B — Chaîne de build (exécutée sur `0d7448a`)

```
$ pnpm install --frozen-lockfile   → Done in 12.8s
$ pnpm check                       → tsc --noEmit : aucune erreur
$ pnpm test                        → Test Files 27 passed (27) · Tests 250 passed (250) · 6.07s
$ pnpm build                       → vite ✓ built in 6.15s
                                     sitemap.xml (15 URL) + robots.txt générés
                                     15 route(s) prérendue(s)
                                     dist/index.js 144.0kb · dist/db-preflight.js 10.5kb
$ pnpm audit --prod                → 18 vulnérabilités : 2 hautes, 14 moyennes, 2 basses
```

Smoke de `dist/index.js` (production, sans `DATABASE_URL`) :

```
/health              200   {"status":"ok"}
/ready               503   {"status":"not_ready","checks":{"database":"unavailable",
                            "redis":"disabled","stripe":"disabled"}}
/                    200   <title>Comparez les offres GPU as a Service | DatacenterMarket</title>
/en/                 200   <title>Compare GPU-as-a-Service offers | DatacenterMarket</title>
/gpu-as-a-service/   200
/robots.txt          200   (10 règles Disallow + Sitemap)
/sitemap.xml         200   (15 <loc>)
/route-inexistante   200   ⚠ identique à / — cf. §4.1
```

## Annexe C — Méthode et limites

**Vérifié** : dépôt à `0d7448a` ; chaîne de build exécutée réellement ; smoke HTTP du bundle de
production ; sondes DNS/HTTP/TLS sur le domaine ; état GitHub (PR, runs CI, historique des crons,
visibilité du dépôt) ; relecture ciblée des invariants métier dans `routers.ts`, `db.ts`, `stripe.ts`,
`inventory.ts`.

**Non vérifié, faute d'accès** : dashboards Render, TiDB/MySQL et Stripe (contenu réel de la base, état
du compte Stripe, existence d'un service d'hébergement) ; parcours E2E en navigateur ; revue ligne à ligne
du diff de la PR #30 (68 fichiers) ; contenu réel des secrets GitHub Actions ; conformité juridique des
pages légales.

**Non refait** : l'audit de sécurité applicatif du 12/07/2026 (`docs/AUDIT-SECURITE-2026-07-12.md`).
Ses 11 constats ont été vérifiés comme *toujours corrigés* dans le code actuel, par sondage sur les deux
constats HIGH ; le présent document ne constitue pas un nouvel audit de sécurité exhaustif.

---

# Addendum — 23 août 2026 : corrections et suites données

*Le rapport ci-dessus est daté et reste tel qu'il a été rendu. Cet addendum corrige deux constats
inexacts et consigne les actions menées le lendemain.*

## A. Corrections au rapport du 22 août

### A.1 — §3.1 était faux sur un point important : la CI de #30 est bel et bien rouge

Le rapport concluait « sa dernière CI est `cancelled`, pas rouge — un run à relancer, pas un test à
corriger ». Le run a été relancé le 23/08 : il **échoue** (run `31123737241`, tentative 2).

La cause est instructive et ne remet pas en cause la qualité de la PR. #30 ajoute à la CI une étape
`pnpm audit:prod` qui fait échouer le build sur **toute** vulnérabilité. Le 6 août elle passait
(0 vulnérabilité). Le 23 août elle en compte 7, sur des avis **publiés depuis** et **étrangers à son
diff** :

- 6 viennent de `streamdown → mermaid → dompurify` — la chaîne du showcase mort (§4.7), dont
  `GHSA-rhh3-jpg6-66xh` (mermaid radar) et `GHSA-55q2-fjhq-7xh7` (DOMPurify) ;
- 1 haute vient de `nanoid` : #30 l'épingle en 5.1.6, or `GHSA-28wg-ghj8-5hjv` exige ≥ 5.1.16.

**#30 n'a donc aucun test cassé.** Elle est rouge parce que le calendrier des avis de sécurité a
bougé sous elle. Les deux correctifs poussés aujourd'hui (suppression de streamdown, montée de
nanoid) suppriment exactement ces 7 constats.

### A.2 — §3.3 : « base de production » est une qualification que le dépôt ne permet pas

Le fait établi reste entier : `DATABASE_URL` est renseigné et la base accepte les connexions depuis
les runners GitHub (log du job : `DATABASE_URL: ***`, `UPDATE` exécuté en ~2 s). Mais **rien dans le
dépôt ne dit qu'il s'agit de la base de production** — et la PR #30 laisse au contraire entendre que
ce secret vise la recette (« *the free Render staging service* », « *Never confirm it unless the
DATABASE_URL repository secret has first been verified to target staging* », `crons.yml:13`).

Lire « base live, joignable depuis des runners publics, dont la nature — recette ou production — n'est
pas déterminable depuis le dépôt ». Le risque baisse d'un cran si c'est bien la recette ; il ne
disparaît pas (credential long terme, destructif, base exposée au réseau public).

## B. Correctifs poussés le 23 août

| Constat | Action | Vérification |
|---|---|---|
| §4.1 soft 404 | Corrigé — politique de fallback SPA reprise **verbatim de la PR #30**, qui la traitait déjà et mieux (voir C.1) | 4 URL inconnues en 404 + `noindex, nofollow`, corps « Not found » ; 6 pages indexables en 200 sans en-tête robots ; 5 routes de tunnel en 200 + noindex |
| §4.7 showcase mort | `ComponentShowcase` (1 437 l.) et `AIChatBox` supprimés, dépendance `streamdown` retirée | `pnpm audit --prod` : 18 → 12 |
| §3.1 dépendances | `axios ^1.17.0 → ^1.19.0`, `nanoid ^5.1.5 → ^5.1.16` | `pnpm audit --prod` : 12 → **1** (la dernière, `body-parser` via express 4, n'a pas de correctif dans la ligne 4.x) |
| §3.3 crons aveugles | `purgeLeadsOlderThan` / `cancelStalePendingOrders` renvoient `affectedRows`, les scripts le journalisent — l'accountability RGPD (art. 5-2) suppose de pouvoir prouver ce qu'une purge a effacé | tests verts ; sera **superseded par #30**, qui fait mieux (voir C.3) |

Nouveau garde-fou : `server/spaFallback.test.ts` vérifie que toute route déclarée dans `App.tsx`
existe dans `SEO_ROUTES`. Cette table est devenue porteuse — une page qu'on y oublierait serait servie
en **404** tout en s'affichant côté client, donc invisible en test manuel et fatale pour l'indexation.

État après ces correctifs : `tsc` clean, **255 tests verts** (29 fichiers), build + prérendu OK,
smoke de `dist/index.js` conforme, **1 vulnérabilité** en dépendances de production.

## C. Revue de la PR #30

**Avis général : à merger, après deux corrections.** Le travail est sérieux, testé, et traite de
vrais problèmes. Rien dans le diff ne justifie qu'il soit resté 16 jours en attente.

### C.1 — Ce qui est bien vu

- **Réservation d'inventaire atomique.** `reserveOfferCapacity` fait un `UPDATE … SET availableCapacity
  = availableCapacity - 1 WHERE id = ? AND availableCapacity > 0` dans une transaction et vérifie
  `affectedRows === 1` : la course entre deux checkouts simultanés est fermée au niveau du SGBD, pas
  applicatif. Le registre `inventoryReservedAt` / `inventoryReleasedAt` rend la libération idempotente
  et laisse les lignes historiques à `null`, donc jamais recréditées à tort.
- **Purge RGPD réconciliée avec les clés étrangères.** Les nouvelles FK sont en `ON DELETE restrict` :
  supprimer un lead référencé par une commande deviendrait impossible. #30 bascule donc sur
  « anonymiser si référencé, supprimer sinon », avec un tombstone `personalDataErasedAt` et un e-mail
  neutralisé calculé **en SQL** (aucune PII matérialisée en mémoire, même sur une grosse purge).
- **Fallback SPA** : meilleur que ce que j'avais écrit — `new URL()` plutôt qu'un découpage de chaîne,
  corps texte au lieu de la coquille applicative, `noindex, nofollow` étendu aux routes déclarées
  noindex, `/404` qui renvoie enfin 404, et politique extraite en fonction pure testée.
- **Contrôle de dérive des migrations en CI** (`db:generate` puis `git diff --exit-code -- drizzle`) :
  empêche un schéma modifié sans migration committée. Excellent réflexe.

### C.2 — Les deux corrections à faire avant merge

1. **🔴 L'opération `migrate-staging` est câblée sur la branche de la PR.** `crons.yml` refuse de migrer
   si `github.ref != 'refs/heads/audit-remediation-2026-08-06'` — dans le garde *et* dans la condition
   du step. Cette branche disparaîtra au merge : l'opération sera définitivement inutilisable, en
   échouant sur « Refusing to migrate from an unapproved branch ». À remplacer par `refs/heads/main`
   (ou une variable de dépôt) **avant** de merger, sinon on livre un outil mort-né.

2. **🟠 Le préflight anti-orphelins de la migration 0007 est probablement inerte sur TiDB.** Il repose
   sur des contraintes `CHECK` d'une table temporaire. TiDB ne les applique que depuis la v7.2 et
   **derrière `tidb_enable_check_constraint`, désactivé par défaut** ; MySQL 8.0.16+ les applique, lui.
   Si la base cible est bien TiDB Serverless (c'est ce que décrit le tutoriel de mise en production),
   le garde passerait silencieusement même avec des orphelins, et l'ajout des FK échouerait ensuite avec
   une erreur bien moins parlante. **À vérifier sur l'instance réelle** ; si c'est confirmé, déplacer
   le comptage d'orphelins dans `server/dbPreflight.ts`, qui tourne déjà au démarrage du conteneur et
   sait échouer proprement.

### C.3 — Points de jugement, non bloquants

- **`pnpm audit:prod` en garde-fou dur** transforme chaque nouvel avis de sécurité en build cassé sur
  des PR qui n'y sont pour rien — c'est précisément ce qui vient d'arriver. La discipline est bonne ;
  reste à décider si l'on assume ce coût tel quel, si l'on ne bloque qu'à partir de « high », ou si on
  l'accompagne d'un job de mise à jour de dépendances pour que la casse soit toujours actionnable.
- **Import paresseux de `vite`** dans `setupVite`, couplé à l'élagage des devDependencies du Dockerfile :
  cohérent, mais cela invalide l'avertissement de `CLAUDE.md` (« full install — le bundle serveur importe
  vite au runtime »). #30 met bien à jour `CLAUDE.md` ; à ne pas perdre au merge.

### C.4 — Conflits attendus avec la branche d'audit

| Fichier | Résolution |
|---|---|
| `server/_core/vite.ts`, `server/_core/vite.test.ts` | Contenu identique des deux côtés sur la partie fallback → fusion propre attendue |
| `server/db.ts` (purge, cancel-stale) | **Prendre la version de #30** : elle renvoie `{anonymized, deleted}` et gère les FK, la mienne se contente d'`affectedRows` |
| `server/purge-leads.ts` | Adapter le message de log à l'objet renvoyé par #30 |
| `package.json`, `pnpm-lock.yaml` | Union : `axios ^1.19.0` (identique des deux côtés), `nanoid ^5.1.16` (à porter dans #30), sans `streamdown` |
| `CLAUDE.md`, `AGENTS.md` | Fusion manuelle, les deux branches les ont amendés |

## D. Ce qui reste entre tes mains

Aucune de ces actions n'est faisable depuis le dépôt :

1. **Corriger puis merger #30** (§C.2), ou me demander de le faire.
2. **Décider du sort de `DATABASE_URL` dans Actions** (§A.2) — retirer le secret et suspendre le
   workflow tant qu'aucune application n'est en ligne reste le geste le plus simple si la base ne
   contient encore aucune donnée client.
3. **Arbitrer domaine canonique et hébergement de production**, puis déployer.
4. **Contractualiser un premier fournisseur réel** et l'activer au back-office — sans quoi le site,
   même en ligne, reste commercialement inerte (§3.2).

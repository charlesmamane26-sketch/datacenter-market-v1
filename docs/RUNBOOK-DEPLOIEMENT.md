# Runbook de déploiement en production — DatacenterMarket

*Procédure opérationnelle, séquencée, pour une mise en production. À dérouler dans l'ordre.*
Pour la référence détaillée par thème (Docker, CSP, Sentry, SEO…), voir [`DEPLOYMENT.md`](../DEPLOYMENT.md).
Ce runbook intègre les changements de l'audit du 2026-07-12 (PR #12) — voir §9 « Deltas ».

> **⏱️ Fenêtre :** ~20–30 min. **Interruption de service :** nulle si la migration est appliquée avant
> le nouveau code (§2). **Rollback :** code seul, sans toucher la base (§7).

---

## 0. Pré-requis & pré-vol

- [ ] **Node 22** + **pnpm** via `corepack enable` (version épinglée dans `package.json`).
- [ ] Base **MySQL/TiDB** managée joignable via `DATABASE_URL` (Docker local inutilisable ici → cloud).
- [ ] Accès au dashboard Stripe (si activation paiement) et aux identifiants OAuth Manus.
- [ ] **Sauvegarde / PITR** activée sur la base **et** un backup récent vérifié avant de commencer.
- [ ] **Merger d'abord les PR ouvertes** dans cet ordre (CI verte sur les deux) :
  1. [PR #12](https://github.com/charlesmamane26-sketch/datacenter-market-v1/pull/12) — correctifs de sécurité (les 11 constats).
  2. [PR #13](https://github.com/charlesmamane26-sketch/datacenter-market-v1/pull/13) — bump des actions GitHub (Node 24).
- [ ] Récupérer `main` à jour après merge : `git checkout main && git pull`.

---

## 1. Variables d'environnement

Copier `.env.example` → `.env` (ne jamais committer un vrai `.env`). Deux catégories.

### 1.1 Runtime serveur — **obligatoires en prod**
| Variable | Rôle / contrainte |
|----------|-------------------|
| `DATABASE_URL` | Connexion MySQL/TiDB. |
| `JWT_SECRET` | Signe les cookies de session. **≥ 32 caractères** sinon le serveur **refuse de démarrer** en prod. Sert aussi de secret au jeton de revendication de lead (correctif #1). |
| `PUBLIC_BASE_URL` | Origine publique, ex. `https://app.datacentermarket.fr`. **Requise en prod** : le serveur lève une erreur sur tout flux Stripe/OAuth si absente (source de confiance pour les URLs Stripe et la validation de l'état OAuth, à la place du header `Host` falsifiable). |
| `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` | Backend OAuth Manus ; `OWNER_OPEN_ID` = compte promu `admin` à la 1ʳᵉ connexion. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | APIs Manus côté serveur. |

### 1.2 Runtime serveur — optionnelles (selon besoin)
| Variable | Quand la mettre |
|----------|-----------------|
| `TRUST_PROXY_HOPS` | Défaut `1`. Nb de proxys de confiance devant l'app (rate-limit fiable sur `req.ip`). À augmenter si plusieurs proxys en cascade. |
| `REDIS_URL` | **Si > 1 instance** : active le rate-limit partagé **et** la révocation de session au logout. Sans lui : par-process / désactivé (OK mono-instance). |
| `CSP_EXTRA_ORIGINS` | Origines CSP additionnelles (analytics Umami, portail OAuth, ingestion Sentry), séparées par des espaces. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paiement (§4). Sans elles, `orders.checkout` renvoie `SERVICE_UNAVAILABLE`. |
| `STRIPE_LIVE_PAYMENTS_ENABLED` | Garde-fou des clés `sk_live_…` : laisser `false` en test/staging ; passer à `true` uniquement après la recette §4. |
| `STRIPE_SMOKE_TEST_ENABLED` | Opt-in ponctuel de `pnpm stripe:smoke`. Laisser `false` hors de cette commande ; le script refuse toute clé live. |
| `DB_READINESS_TIMEOUT_MS` (déf. 5000), `DB_PREFLIGHT_TIMEOUT_MS` (déf. 10000) | Délais max des contrôles DB de readiness et de pré-vol read-only. |
| `TELEMETRY_INGEST_KEY` | Active `POST /api/telemetry/:orderId` (sinon `503`). |
| `EMAIL_API_URL`, `EMAIL_API_KEY` | Emails clients (confirmation, infra prête). Sans elles : loggé (destinataire masqué, correctif #9), non envoyé. |
| `SENTRY_DSN` | Monitoring erreurs serveur. |
| `LEAD_RETENTION_DAYS` (déf. 730), `STALE_ORDER_HOURS` (déf. 24) | Rétention RGPD / annulation des paniers abandonnés (§4). |

### 1.3 Build-time (`VITE_*`) — **inlinées dans le bundle au `pnpm build`**
> ⚠️ Les `VITE_*` sont figées **au build**, pas au runtime. En Docker : `--build-arg`. En CI : secrets de repo.

- [ ] `VITE_SITE_URL` — **domaine canonique** (canonical, Open Graph, `sitemap.xml`, `robots.txt`, pages prérendues). Défaut `https://www.datacentermarket.fr` — **à valider avant build**.
- [ ] `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` — construisent l'URL de login.
- [ ] `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` — APIs Manus côté front.
- [ ] `VITE_SENTRY_DSN` (opt.), `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` (opt.).

---

## 2. 🔴 Migrations base de données — À FAIRE AVANT LE CODE

Le code courant dépend de `0004` pour la preuve de consentement RGPD, de `0005` pour le journal
Stripe durable, les références de souscription et l'idempotence du checkout, et de `0006` pour les
fournisseurs, l'inventaire fail-closed et le snapshot fournisseur des commandes. Si le code part avant ces
migrations, la capture de lead, le paiement ou le matching échoue.

```bash
# Dans l'environnement qui a accès à la base (DATABASE_URL défini sur la base cible)
corepack enable
pnpm install --frozen-lockfile
pnpm db:push        # génère, puis applique explicitement toutes les migrations en attente
pnpm db:preflight   # SELECT-only : connexion + timestamps/hashes exacts de toutes les migrations
```

- Lire et approuver chaque fichier SQL avant `db:push`; sauvegarde/PITR vérifiés au préalable.
- `db:preflight` ne crée rien et n'applique rien. Il échoue si la base n'est pas joignable, si la
  moindre migration du journal manque ou si son timestamp/hash diffère de celui enregistré en
  base. Il exige aussi une correspondance exacte entre le journal et tous les fichiers SQL ; leurs
  fins de ligne sont forcées en LF par `.gitattributes` pour stabiliser les hashes Windows/Linux.
- Si la base a reçu des migrations depuis Windows avant cette règle LF, un écart peut être purement
  CRLF/LF. Sous sauvegarde/PITR, comparer le hash enregistré et les effets SQL ; ne réconcilier
  `__drizzle_migrations` qu'après cette preuve. Ne jamais rejouer ni réécrire aveuglément une
  migration déjà appliquée.
- `0004`, `0005` et `0006` sont **additives**, sans suppression de données.
- **Ordre impératif : migration → puis déploiement du code.** L'inverse casse la capture de leads.
- Revoir notamment `drizzle/0004_true_omega_sentinel.sql`, `drizzle/0005_soft_toad_men.sql` et
  `drizzle/0006_mysterious_charles_xavier.sql`.

> Séparation possible : appliquer la migration quelques minutes avant de basculer le code. L'ancien
> code ignore simplement les nouveaux objets/colonnes (compatibilité ascendante), donc ils peuvent
> être ajoutés un peu avant la bascule.

---

## 3. Build, seed & déploiement

```bash
pnpm install --frozen-lockfile   # jeu COMPLET de deps (jamais --prod : le serveur importe vite au runtime)
pnpm db:seed                     # lignes de DÉMO inactives ; jamais une validation fournisseur
pnpm build                       # vite -> dist/public + seo:files + prerender + esbuild -> dist/index.js
pnpm start                       # NODE_ENV=production node dist/index.js
```

Le seed est idempotent mais volontairement **fail-closed** : fournisseurs inactifs, offres
indisponibles, capacité à 0, sans échéance. Dans le back-office, remplacer/valider les données
commerciales, affecter le bon fournisseur, saisir une capacité et une échéance future, puis activer.
La capacité reste un snapshot opérateur, pas encore une réservation automatique par commande.

- **Ne pas élaguer en `--prod`** : le bundle serveur importe `vite` au runtime → crash au démarrage sinon.
- **Compression** : activer gzip/brotli **au reverse proxy** (nginx/Caddy/CDN) — l'Express sert le statique non compressé.
- **Docker** : voir `DEPLOYMENT.md §4` (passer les `VITE_*` en `--build-arg`, l'image tourne en
  `USER node`). Son entrypoint exécute le pré-vol DB read-only avant Node et refuse d'activer une
  image si une migration du dépôt manque ou dérive. Il n'applique jamais de migration.
- **Render** : le Blueprint attend la CI verte (`checksPass`) et sonde `/health` comme liveness.
  Superviser `/ready` séparément pour la disponibilité MySQL/TiDB et Redis. Le `plan: free` est
  volontairement conservé pour le **staging/recette uniquement** (mise en veille possible, aucun
  engagement de production) ; le pré-vol reste dans l'entrypoint Docker.

---

## 4. Activation Stripe (paiement)

1. Renseigner `STRIPE_SECRET_KEY` (runtime).
   - commencer par `sk_test_…` (ou `rk_test_…` si les droits restreints suffisent), avec
     `STRIPE_LIVE_PAYMENTS_ENABLED=false` ;
   - pour `sk_live_…` ou `rk_live_…`, ne passer le drapeau à `true` qu'après la recette complète ci-dessous. Une
     clé live avec le drapeau à `false` est volontairement refusée par le serveur.
2. Dashboard Stripe → Webhooks → endpoint sur **`POST {PUBLIC_BASE_URL}/api/stripe/webhook`**. Abonner :
   - `checkout.session.completed` (obligatoire) ;
   - **`checkout.session.async_payment_succeeded`** et **`checkout.session.async_payment_failed`**
     → **requis si** tu actives un moyen de paiement à débit différé (prélèvement SEPA, virement…).
     Le webhook ne marque « payé » que sur `payment_status === "paid"` et réconcilie l'async via ces
     deux événements (correctif #2). En **carte seule**, `checkout.session.completed` suffit.
3. Copier le *signing secret* du webhook → `STRIPE_WEBHOOK_SECRET`.
   Le checkout refuse une configuration partielle ou mal typée : clé API et `whsec_…` doivent être
   présents ensemble ; en production `PUBLIC_BASE_URL` doit être une origine HTTPS sans chemin.
4. Vérifier que `TRUST_PROXY_HOPS` est correct pour que l'IP/origine se résolvent derrière le LB.

Avant le paiement manuel, valider l'hypothèse technique « abonnement mensuel + frais d'installation
one-shot » par un appel réel à l'API Stripe **test**. La commande crée une Checkout Session de test,
vérifie exactement devise/montants/intervalle/métadonnées/URLs, l'expire, puis archive les Price et
Product inline créés ; elle ne paie rien et refuse systématiquement toute clé live ou inconnue.
L'opt-in doit rester ponctuel :

```powershell
$env:STRIPE_SMOKE_TEST_ENABLED = "true"
pnpm stripe:smoke
Remove-Item Env:STRIPE_SMOKE_TEST_ENABLED
```

Critère : sortie `ok: true`, un item `recurring`, un item `one_time`, puis `cleanup: "expired"`.
Ne pas conserver l'opt-in à `true` dans Render, GitHub ou un fichier `.env` partagé.

> Le webhook est la **source de vérité** du paiement ; `orders.checkout` ne crée qu'une commande
> *pending*. `updatePaymentStatus`/`updateStatus` restent admin-only.

---

## 5. Crons RGPD

Planifier deux tâches (cron hôte, ou `.github/workflows/crons.yml` déjà présent) :

```bash
pnpm db:cancel-stale   # horaire : annule les paniers pending/unpaid > STALE_ORDER_HOURS
pnpm db:purge          # quotidien : supprime les leads non convertis > LEAD_RETENTION_DAYS
```

- **Comportement de purge (correctif #4)** : supprime désormais **tout lead non `converted`** hors
  fenêtre de rétention (y compris `offered`/`qualified` abandonnés) ; ne protège que les leads liés à
  une commande **non annulée**. Aligne la conservation sur la politique 24 mois affichée.
- **🔐 Durcissement (correctif #11)** : si tu utilises `crons.yml` (runners GitHub) avec le secret
  `DATABASE_URL`, **ne laisse pas la base ouverte à `0.0.0.0/0`**. Préférer un cron dans le réseau du
  déploiement / un self-hosted runner dans le VPC ; sinon restreindre l'ingress aux IP GitHub et
  scoper le credential. Voir l'en-tête commenté de `crons.yml`.

---

## 6. Smoke tests post-déploiement (dans l'ordre)

- [ ] **Liveness** : `GET {PUBLIC_BASE_URL}/health` → `{"status":"ok"}`.
- [ ] **Readiness** : `GET {PUBLIC_BASE_URL}/ready` → `200`, avec `database: "ready"`, Redis
      `"ready"` ou `"disabled"`, et Stripe `"ready"` ou `"disabled"` selon la configuration. Cette
      URL est supervisée séparément ; la
      sonde liveness Render reste sur `/health`.
- [ ] **Capture de lead + consentement** (valide la migration §2) : remplir le WorkloadForm jusqu'au
      bout (case de consentement obligatoire) → le lead est créé sans erreur 500.
- [ ] **Funnel anonyme complet** (valide le jeton de revendication, correctif #1) : depuis le même
      navigateur, WorkloadForm → Résultats → Choix d'offre → connexion → `Procéder au paiement`
      aboutit (le jeton stocké en `localStorage` autorise la commande).
- [ ] **OAuth** : login puis logout (avec Redis : vérifier que la session est bien révoquée).
- [ ] **Carte / CSP** : une page avec la carte s'affiche (CSP ne bloque pas le proxy Forge / Google Fonts) ; console navigateur sans violation CSP.
- [ ] **Paiement Stripe de bout en bout** : un paiement réel atteint `paymentStatus: succeeded` via le
      webhook, le lead passe `converted`, la timeline de provisioning s'affiche.
- [ ] **Export CSV admin** : exporter les leads ; ouvrir dans un tableur → aucune cellule ne s'exécute
      comme formule (préfixe `=`/`+`/`-`/`@` neutralisé, correctif #5).

---

## 7. Rollback

- **Code** : redéployer l'image / le commit précédent. Les migrations `0004` à `0006` étant
  **additives**, l'ancien code fonctionne avec les nouveaux objets/colonnes (il les ignore) →
  **pas besoin de rollback de la base.**
- **Base** : ne pas rétrograder le schéma. En cas d'incident data, restaurer depuis le backup/PITR (§0).
- **Stripe** : en cas de webhook défaillant, les paiements restent `pending` (aucune sur-facturation) ;
  corriger l'endpoint/secret puis rejouer les événements depuis le dashboard Stripe (Webhooks → tentatives).

---

## 8. Décision Go / No-Go (checklist finale)

- [ ] PR #12 et #13 mergées, CI verte, `main` à jour.
- [ ] `JWT_SECRET` ≥ 32 car. et `PUBLIC_BASE_URL` définis (sinon le serveur ne démarre pas / refuse Stripe/OAuth).
- [ ] Toutes les migrations, dont `0004` à `0006`, **appliquées** (`pnpm db:push`) — **avant** la
      bascule du code ; `pnpm db:preflight` vert ensuite.
- [ ] `VITE_*` (dont `VITE_SITE_URL` validé) présents **au build**.
- [ ] Backup base récent et vérifié.
- [ ] Smoke tests §6 passés en staging.
- [ ] (Si paiement) webhook Stripe configuré avec les bons événements (§4).
- [ ] (Si crons GitHub) ingress DB restreint (§5).

---

## 9. Deltas introduits par l'audit (vs `DEPLOYMENT.md`)

`DEPLOYMENT.md` précède les correctifs de la PR #12 ; ce runbook fait foi sur ces points :
- **Migrations** : `0004` porte la preuve de consentement, `0005` le journal/idempotence Stripe et
  `0006` l'inventaire fournisseur fail-closed ainsi que le snapshot fournisseur des commandes.
- **Webhook Stripe (§4)** : s'abonner aussi à `async_payment_succeeded` / `async_payment_failed` si
  paiements différés (le handler exige `payment_status === "paid"`).
- **Purge RGPD (§5)** : purge élargie aux leads non convertis abandonnés ; ne protège que les commandes non annulées.

Rapport d'audit complet : [`docs/AUDIT-SECURITE-2026-07-12.md`](AUDIT-SECURITE-2026-07-12.md).

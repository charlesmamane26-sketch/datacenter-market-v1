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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paiement (§3). Sans elles, `orders.checkout` renvoie `SERVICE_UNAVAILABLE`. |
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

## 2. 🔴 Migration base de données — À FAIRE AVANT LE CODE

La PR #12 ajoute deux colonnes à `leads` (`consentedAt`, `consentPolicyVersion`, migration
`drizzle/0004_true_omega_sentinel.sql`). Le nouveau `leads.create` **écrit** ces colonnes : si le
code part avant la migration, **toute capture de lead échoue** (colonnes inexistantes).

```bash
# Dans l'environnement qui a accès à la base (DATABASE_URL défini sur la base cible)
corepack enable
pnpm install --frozen-lockfile
pnpm db:push        # applique 0004 : ADD COLUMN consentedAt / consentPolicyVersion (nullable)
```

- Colonnes **nullable** → migration **additive**, sans downtime, sans impact sur les lignes existantes.
- **Ordre impératif : migration → puis déploiement du code.** L'inverse casse la capture de leads.
- Revoir le SQL généré avant application en prod (`drizzle/0004_true_omega_sentinel.sql`).

> Séparation possible : appliquer la migration quelques minutes avant de basculer le code. L'ancien
> code ignore simplement les nouvelles colonnes (compatibilité ascendante), donc aucun risque à les
> ajouter en avance.

---

## 3. Build, seed & déploiement

```bash
pnpm install --frozen-lockfile   # jeu COMPLET de deps (jamais --prod : le serveur importe vite au runtime)
pnpm db:seed                     # catalogue d'offres (idempotent) — 1ʳᵉ mise en prod uniquement
pnpm build                       # vite -> dist/public + seo:files + prerender + esbuild -> dist/index.js
pnpm start                       # NODE_ENV=production node dist/index.js
```

- **Ne pas élaguer en `--prod`** : le bundle serveur importe `vite` au runtime → crash au démarrage sinon.
- **Compression** : activer gzip/brotli **au reverse proxy** (nginx/Caddy/CDN) — l'Express sert le statique non compressé.
- **Docker** : voir `DEPLOYMENT.md §4` (passer les `VITE_*` en `--build-arg`, l'image tourne en `USER node`).

---

## 4. Activation Stripe (paiement)

1. Renseigner `STRIPE_SECRET_KEY` (runtime).
2. Dashboard Stripe → Webhooks → endpoint sur **`POST {PUBLIC_BASE_URL}/api/stripe/webhook`**. Abonner :
   - `checkout.session.completed` (obligatoire) ;
   - **`checkout.session.async_payment_succeeded`** et **`checkout.session.async_payment_failed`**
     → **requis si** tu actives un moyen de paiement à débit différé (prélèvement SEPA, virement…).
     Le webhook ne marque « payé » que sur `payment_status === "paid"` et réconcilie l'async via ces
     deux événements (correctif #2). En **carte seule**, `checkout.session.completed` suffit.
3. Copier le *signing secret* du webhook → `STRIPE_WEBHOOK_SECRET`.
4. Vérifier que `TRUST_PROXY_HOPS` est correct pour que l'IP/origine se résolvent derrière le LB.

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

- **Code** : redéployer l'image / le commit précédent. La migration `0004` étant **additive et
  nullable**, l'ancien code fonctionne tel quel avec les colonnes présentes (il les ignore) →
  **pas besoin de rollback de la base.**
- **Base** : ne pas rétrograder le schéma. En cas d'incident data, restaurer depuis le backup/PITR (§0).
- **Stripe** : en cas de webhook défaillant, les paiements restent `pending` (aucune sur-facturation) ;
  corriger l'endpoint/secret puis rejouer les événements depuis le dashboard Stripe (Webhooks → tentatives).

---

## 8. Décision Go / No-Go (checklist finale)

- [ ] PR #12 et #13 mergées, CI verte, `main` à jour.
- [ ] `JWT_SECRET` ≥ 32 car. et `PUBLIC_BASE_URL` définis (sinon le serveur ne démarre pas / refuse Stripe/OAuth).
- [ ] Migration `0004` **appliquée** (`pnpm db:push`) — **avant** la bascule du code.
- [ ] `VITE_*` (dont `VITE_SITE_URL` validé) présents **au build**.
- [ ] Backup base récent et vérifié.
- [ ] Smoke tests §6 passés en staging.
- [ ] (Si paiement) webhook Stripe configuré avec les bons événements (§4).
- [ ] (Si crons GitHub) ingress DB restreint (§5).

---

## 9. Deltas introduits par l'audit (vs `DEPLOYMENT.md`)

`DEPLOYMENT.md` précède les correctifs de la PR #12 ; ce runbook fait foi sur ces points :
- **Migration** : la migration pertinente est désormais **`0004`** (colonnes de consentement), pas 0002/0003.
- **Webhook Stripe (§4)** : s'abonner aussi à `async_payment_succeeded` / `async_payment_failed` si
  paiements différés (le handler exige `payment_status === "paid"`).
- **Purge RGPD (§5)** : purge élargie aux leads non convertis abandonnés ; ne protège que les commandes non annulées.

Rapport d'audit complet : [`docs/AUDIT-SECURITE-2026-07-12.md`](AUDIT-SECURITE-2026-07-12.md).

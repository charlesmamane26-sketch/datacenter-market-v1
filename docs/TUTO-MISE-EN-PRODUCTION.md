# Tutoriel — Mettre DatacenterMarket en production

> **Pour qui ?** Charles (Anavim Advisory) — aucune compétence DevOps avancée requise.
> **Point de départ :** les Phases 0 et 1 (sécurité) sont déjà faites et poussées sur GitHub.
> **Objectif :** passer du dépôt GitHub à un site public qui encaisse de vrais paiements.
> **Durée estimée :** 2 à 4 heures réparties sur 2-3 jours (délais de vérification de comptes).

---

## Vue d'ensemble

Il reste trois briques externes à brancher, puis le déploiement :

| Étape | Service | Compte à créer | Coût |
|---|---|---|---|
| 1. Base de données | TiDB Serverless | tidbcloud.com | **0 €** (jusqu'à 5 Go) |
| 2. Hébergement de recette | Render (free tier) | render.com | **0 €** |
| 2bis. Crons RGPD | GitHub Actions | déjà en place | **0 €** |
| 3. Paiements | Stripe | stripe.com | **0 €** fixe (commission ~1,5 % + 0,25 € par vente uniquement) |
| 4. Monitoring | Sentry + UptimeRobot | sentry.io, uptimerobot.com | **0 €** (tiers free) |

**Budget de recette : 0 € de coût fixe.** L'hébergement de production n'est volontairement pas
chiffré ici : le Blueprint Free sert uniquement au staging, sans paiement client réel.

⚠️ **Périmètre du tier gratuit Render :** staging/recette uniquement. La mise en veille et l'absence
d'engagement de production sont acceptables pour les tests, pas pour recevoir du trafic client ou
activer Stripe live. Le choix de l'hébergement de production est une décision séparée.

**Règle d'or : ne jamais mettre une clé secrète dans Git.** Toutes les clés vont dans les variables d'environnement de l'hébergeur.

---

## Étape 1 — La base de données MySQL cloud (~30 min)

Le projet utilise Drizzle ORM sur MySQL. Le plus simple et gratuit : **TiDB Serverless** (compatible MySQL).

### 1.1 Créer le cluster

1. Va sur **https://tidbcloud.com** → *Sign up* (compte Google possible).
2. Clique **Create Cluster** → choisis **Serverless** (gratuit jusqu'à 5 Go).
3. Région : **Frankfurt (eu-central-1)** — données en UE, cohérent avec le positionnement RGPD du site.
4. Une fois le cluster créé, clique **Connect** en haut à droite.
5. Choisis *Connect With* → **General**, génère le mot de passe, et note la chaîne de connexion. Elle ressemble à :

```
mysql://xxxxxx.root:MOT_DE_PASSE@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}
```

⚠️ **Mot de passe avec caractères spéciaux** (`#`, `@`, `/`, `?`, `%`…) : encode-les en
pourcent dans l'URL (ex. `#` → `%23`) ou régénère jusqu'à obtenir un mot de passe
alphanumérique — sinon la connexion échoue avec « Invalid URL ».

### 1.2 Créer la base et pousser le schéma

**D'abord, crée la base** (elle n'existe pas par défaut — TiDB ne pré-crée que `test`) :
dans TiDB Cloud → ton cluster → **SQL Editor**, exécute :

```sql
CREATE DATABASE datacenter_market;
```

Puis depuis ton PC, dans le dossier du projet :

```bash
cd C:\Users\user\Downloads\datacenter-market-v1-main

# Mets la chaîne de connexion dans .env (remplace la ligne DATABASE_URL existante)
# DATABASE_URL=mysql://xxxxxx.root:MOT_DE_PASSE@gateway01...:4000/datacenter_market?ssl={"rejectUnauthorized":true}
# (remplace /test par /datacenter_market dans l'URL)

# Active pnpm via corepack (une seule fois — Node 22 requis)
corepack enable

# Crée les tables
corepack pnpm db:push

# Vérifie en lecture seule toutes les migrations (timestamp + hash SQL exact)
corepack pnpm db:preflight

# Insère 7 offres de DÉMO inactives (aucune n'est vendable sans validation admin)
corepack pnpm db:seed

# Après activation d'au moins une vraie offre/fournisseur dans le back-office :
# vérifie le tunnel complet contre cette base
corepack pnpm integration-check
```

Le seed ne constitue jamais un inventaire commercial : fournisseurs inactifs, capacité 0 et offres
indisponibles. Après le premier déploiement, renseigne/valide les fournisseurs, prix, SLA et échéances
dans `/admin`, puis active seulement les offres réellement confirmées.

Le pré-vol exige que le journal, tous les fichiers `drizzle/*.sql` et toutes les lignes de
`__drizzle_migrations` correspondent exactement. `.gitattributes` fixe les SQL en LF. Si une base
existante signale un hash différent après une ancienne application Windows, ne rejoue pas la
migration : sous sauvegarde/PITR, prouve d'abord que l'unique différence est CRLF/LF avant toute
réconciliation du journal.

✅ **Critère de réussite :** `integration-check` affiche « Full funnel verified against the real database ».

> 💡 *Alternative OVH :* si tu préfères rester chez OVH (cohérent avec ton infra existante), une instance « Web Cloud Databases MySQL » fonctionne aussi — récupère simplement l'URL de connexion au même format.

---

## Étape 2 — Le staging gratuit sur Render (~45 min)

Le projet a un Dockerfile prêt. Le tier gratuit **Render** suffit pour la recette ; il ne constitue
pas l'hébergement de production.

### 2.1 Créer le service Render

Le repo contient un **Blueprint** (`render.yaml` à la racine) qui pré-configure tout
(Docker, région Frankfurt, plan Free staging-only, liveness `/health`, déploiement après CI verte, liste des
variables) :

1. Va sur **https://render.com** → *Sign up with GitHub*.
2. **New** → **Blueprint** → connecte le repo `datacenter-market-v1`.
3. Render lit `render.yaml`, crée le service et te présente la liste des variables
   à remplir (celles marquées `sync: false`) — passe à l'étape 2.2 pour les valeurs.

*(Chemin manuel équivalent pour le staging : New → Web Service → Language **Docker**,
Instance Type **Free**, Région **Frankfurt**.)*

### 2.2 Configurer les variables d'environnement

Dans Render → ton service → onglet **Environment**, ajoute :

| Variable | Valeur | Note |
|---|---|---|
| `DATABASE_URL` | la chaîne TiDB de l'étape 1 | secrète |
| `JWT_SECRET` | 64 caractères aléatoires | généré automatiquement par le Blueprint (`generateValue`) ; sinon commande ci-dessous |
| `PUBLIC_BASE_URL` | `https://ton-service.onrender.com` (puis ton domaine custom) | **obligatoire** — sans elle le serveur refuse les flux Stripe/OAuth. À la création du Blueprint tu ne connais pas encore l'URL exacte (Render peut ajouter un suffixe aléatoire au nom) : mets un placeholder, puis après le 1ᵉʳ déploiement copie l'URL réelle depuis le dashboard et corrige la variable |
| `CSP_EXTRA_ORIGINS` | origines à autoriser dans la CSP, séparées par des espaces | **requis si** `VITE_SENTRY_DSN` (mets l'origine ingest Sentry, ex. `https://oXXXX.ingest.de.sentry.io`) ou analytics ; sinon laisse vide |
| `EMAIL_API_URL` / `EMAIL_API_KEY` | API d'e-mails transactionnels | optionnel — **sans elles, les e-mails clients (commande confirmée, infra prête) sont seulement loggés, jamais envoyés** |
| `OAUTH_SERVER_URL` | URL du serveur OAuth Manus | depuis ton espace Manus |
| `OWNER_OPEN_ID` | ton openId Manus | c'est ce qui fait de toi l'admin |
| `BUILT_IN_FORGE_API_URL` | API Manus côté serveur | depuis ton espace Manus (cartes, stockage) |
| `BUILT_IN_FORGE_API_KEY` | clé API Manus côté serveur | secrète |
| `STRIPE_SECRET_KEY` | *(étape 3)* | commence par `sk_test_` puis `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | *(étape 3)* | commence par `whsec_` |
| `STRIPE_LIVE_PAYMENTS_ENABLED` | `false` | garde-fou Blueprint ; ne passer à `true` qu'à l'étape 3.4 |
| `SENTRY_DSN` | *(étape 4)* | optionnel au début |

(Pas besoin de `PORT` : Render le fournit automatiquement et l'app le lit.)

Pour générer le `JWT_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **Important :** le serveur refuse de démarrer en production si `JWT_SECRET` fait moins de 32 caractères (protection ajoutée en Phase 1).

### 2.3 Les variables de build (VITE_*)

Ces variables sont **compilées dans le JavaScript public** au moment du build — n'y mets jamais un secret :

- `VITE_APP_ID` — l'identifiant de ton app Manus
- `VITE_OAUTH_PORTAL_URL` — l'URL du portail de login Manus
- `VITE_FRONTEND_FORGE_API_URL` / `VITE_FRONTEND_FORGE_API_KEY` — API Forge frontend (clé publique uniquement)
- `VITE_SITE_URL` — le domaine canonique public (SEO : canonicals, sitemap, Open Graph).
  Au départ mets l'URL `.onrender.com` ; quand le domaine définitif est branché, change-la
  et redéploie (**Clear build cache & deploy**)
- `VITE_SENTRY_DSN` — *(optionnel)* Sentry côté navigateur (étape 4.1) ; exige
  `CSP_EXTRA_ORIGINS` (étape 2.2), sinon les événements sont bloqués silencieusement par la CSP
- `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` — *(optionnel)* analytics Umami ;
  exige aussi `CSP_EXTRA_ORIGINS` + un rebuild

Ajoute-les aussi dans **Environment** : Render rend les variables d'environnement disponibles pendant le build Docker. Si après déploiement le bouton de login pointe dans le vide, c'est qu'elles manquaient au build — ajoute-les puis **Manual Deploy → Clear build cache & deploy**.

### 2.4 Domaine et déploiement

1. Render te donne d'office un domaine gratuit en `xxx.onrender.com` — suffisant pour la recette.
2. *(Optionnel, toujours 0 €)* : pour `compute.anavim-infra.com`, ajoute un **Custom Domain** dans Render → Settings, puis crée le CNAME indiqué dans ta zone DNS OVH (le domaine anavim-infra.com est déjà payé). Certificat TLS automatique.
3. Chaque `git push` sur `main` redéploie seulement après réussite des checks GitHub. Le conteneur
   exécute aussi un pré-vol DB **read-only** avant de démarrer ; toute migration absente ou dont le
   timestamp/hash dérive bloque la nouvelle image sans modifier la base.

✅ **Critère de réussite :** `https://ton-domaine/health` répond `{"status":"ok"}`, `/ready`
répond `200` avec `database: "ready"`, et la landing s'affiche.

### 2.5 Les crons RGPD — gratuits via GitHub Actions

Le tier gratuit Render n'inclut pas les cron jobs, mais **GitHub Actions** les exécute
gratuitement. Le workflow **existe déjà** dans le repo (`.github/workflows/crons.yml` :
purge des leads tous les jours à 03:00 UTC, annulation des commandes abandonnées toutes
les heures). Il ne manque qu'une chose :

Dans GitHub → repo → **Settings → Secrets and variables → Actions** → ajoute le secret
`DATABASE_URL` (la même chaîne TiDB). Teste avec **Actions → RGPD crons → Run workflow**.

---

## Étape 3 — Stripe (~45 min + délai de vérification du compte)

> ⚠️ Le tier gratuit reste réservé à la recette : ne l'utilise pas pour Stripe live. Les retries
> Stripe permettent de tester les webhooks, mais seule une instance de production non dormante
> convient aux encaissements clients.

### 3.1 Créer le compte

1. **https://stripe.com** → crée le compte au nom d'**Anavim Advisory SAS** (SIREN, IBAN, adresse 10 rue du Colisée).
2. La vérification d'identité peut prendre 1-2 jours — commence en **mode test** sans attendre.

### 3.2 Mode test d'abord (obligatoire)

1. Dashboard Stripe → active le **mode Test** (toggle en haut à droite).
2. **Développeurs → Clés API** : copie la **clé secrète** `sk_test_...` → variable `STRIPE_SECRET_KEY` dans Render.
   Garde `STRIPE_LIVE_PAYMENTS_ENABLED=false`.
3. **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://ton-domaine/api/stripe/webhook`
   - Événement à écouter : `checkout.session.completed` (celui-là suffit)
4. Copie le **Signing secret** `whsec_...` → variable `STRIPE_WEBHOOK_SECRET` dans Render.
5. Redéploie (Render le fait automatiquement quand tu changes une variable).

### 3.3 Tester un paiement de bout en bout

Commence par valider l'hypothèse « abonnement + frais d'installation » directement sur l'API
Stripe test. Cette commande crée une session sans payer, vérifie les deux line items puis l'expire ;
elle refuse toute clé live :

```powershell
$env:STRIPE_SMOKE_TEST_ENABLED = "true"
pnpm stripe:smoke
Remove-Item Env:STRIPE_SMOKE_TEST_ENABLED
```

Attends `ok: true`, un item `recurring`, un `one_time`, puis `cleanup: "expired"`. Ne configure pas
`STRIPE_SMOKE_TEST_ENABLED=true` durablement dans Render ou `.env`.

1. Sur ton site : remplis le formulaire workload → choisis une offre → connecte-toi → **Confirm Order**.
2. Sur la page Stripe, paie avec la carte de test : **4242 4242 4242 4242**, date future, CVC 424.
3. Vérifie dans l'ordre :
   - Tu es redirigé vers `/confirmation` avec la timeline de provisioning ;
   - Dashboard Stripe (mode test) → le paiement apparaît ;
   - Ton dashboard admin (`/admin`) → le lead est passé à **converted** ;
   - Stripe → Webhooks → l'événement est en **Succeeded** (200).

⚠️ Le smoke test valide la forme de la Checkout Session mais ne simule ni paiement ni webhook.
Choisis donc aussi une offre **avec frais d'installation** (setup fee > 0) dans le test navigateur.

### 3.4 Passage en live

Quand le compte est vérifié **et** que le test ci-dessus passe :

1. Désactive le mode test → copie `sk_live_...` → remplace `STRIPE_SECRET_KEY`.
2. Recrée le webhook en mode live (nouveau secret `whsec_...` — l'URL, elle, ne change pas) → remplace `STRIPE_WEBHOOK_SECRET`.
3. Après vérification contractuelle/fournisseur et du webhook, passe
   `STRIPE_LIVE_PAYMENTS_ENABLED=true` puis redéploie. Sans ce drapeau, une clé live est
   volontairement refusée.
4. Fais **un vrai paiement** avec ta propre carte sur l'offre la moins chère, puis rembourse-le depuis le dashboard Stripe.
5. Active **Stripe Tax** si tu factures de la TVA UE (B2B : autoliquidation avec numéro de TVA).

---

## Étape 4 — Monitoring et go-live (~30 min)

### 4.1 Sentry (erreurs serveur)

1. **https://sentry.io** → compte gratuit → **Create Project** → plateforme **Node.js (Express)**.
2. Copie le **DSN** (`https://xxx@yyy.ingest.sentry.io/zzz`) → variable `SENTRY_DSN` dans Render.
3. C'est tout — l'intégration est déjà câblée dans le code. Au prochain déploiement, le log affichera `[Sentry] Server monitoring initialized.`

### 4.2 Uptime

1. **https://uptimerobot.com** → compte gratuit → **Add Monitor** :
   - Type : HTTP(s) — URL : `https://ton-domaine/ready` — intervalle : 5 min.
2. Configure l'alerte e-mail vers `contact@anavim-infra.com`.

Sur le plan Free, une mise en veille et un cold start sont attendus. Le monitor `/ready` sert à
alerter sur MySQL/TiDB/Redis ; la sonde Render reste `/health`. Ne détourne pas le monitoring pour
transformer ce staging en pseudo-production toujours éveillée.

### 4.3 Télémétrie GPU — réglé pour le lancement

Le dashboard client n'affiche plus d'état « en attente » permanent : sans données, la
tuile KPI montre le **statut du service** et le panneau télémétrie n'apparaît que
lorsque de vraies métriques arrivent. Rien à faire au lancement. Le jour où un provider
pousse des métriques (`POST /api/telemetry/:orderId` + `TELEMETRY_INGEST_KEY`, cf.
DEPLOYMENT.md §11), l'affichage GPU s'active tout seul. (`pnpm db:telemetry` reste
réservé aux démos locales — jamais en production.)

### 4.4 Checklist finale avant d'annoncer le site

- [ ] `https://ton-domaine/health` → `{"status":"ok"}`
- [ ] `https://ton-domaine/ready` → `200`, base `"ready"` (Redis `"ready"` ou `"disabled"`)
- [ ] Landing, formulaire, résultats, CGU/confidentialité/mentions légales s'affichent
- [ ] Login OAuth fonctionne et **ton compte a bien le rôle admin** (`/admin` accessible)
- [ ] Paiement test 4242… complet : lead `converted` + webhook 200
- [ ] Paiement réel + remboursement OK (mode live)
- [ ] Crons `db:purge` et `db:cancel-stale` planifiés
- [ ] Sentry reçoit les événements, UptimeRobot est vert
- [ ] Sauvegardes activées côté base (TiDB Serverless : automatiques)

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le serveur ne démarre pas, log « JWT_SECRET must be at least 32 characters » | Secret trop court | Régénère avec la commande de l'étape 2.2 |
| Le conteneur s'arrête sur `[DB preflight] Failed` | Base inaccessible, migration en attente ou hash différent | Vérifie les identifiants ; révise/applique explicitement les migrations avec `db:push`, puis relance `db:preflight` |
| « Database not available » sur le site | `DATABASE_URL` absente ou fausse | Vérifie la variable dans Render, teste avec `integration-check` en local |
| « Payments are not configured » au checkout | clé Stripe, `whsec_…` ou origine HTTPS absente/invalide | Étape 3.2 et `GET /ready` |
| « Live Stripe payments are disabled » | Clé `sk_live_…`/`rk_live_…` présente mais garde-fou encore à `false` | Termine la checklist 3.4, puis passe `STRIPE_LIVE_PAYMENTS_ENABLED=true` et redéploie |
| Le paiement passe mais le lead reste « offered » | Webhook mal configuré | Vérifie l'URL du webhook et le `whsec_`, regarde Stripe → Webhooks → tentatives |
| Login OAuth en boucle ou erreur 400 « invalid state » | `PUBLIC_BASE_URL` ne correspond pas à l'URL réelle du service, ou `VITE_OAUTH_PORTAL_URL` / `VITE_APP_ID` faux, ou domaine non déclaré côté Manus | Vérifie que `PUBLIC_BASE_URL` = l'URL exacte affichée dans le dashboard Render, puis les variables de build et la config de l'app Manus |
| Pas de rôle admin après login | `OWNER_OPEN_ID` ne correspond pas à ton openId | Récupère ton openId exact (table `users` après ta 1ʳᵉ connexion) et corrige la variable |
| Première visite de recette lente puis tout va bien | Tier gratuit Render : le serveur dormait | Normal en staging ; ne route aucun trafic de production vers ce service Free |

---

*Document du 10 juin 2026, mis à jour le 20 juillet 2026 (liveness/readiness, préflight complet et staging Render Free) — accompagne `PRODUCTION-PLAN.md` (état technique) dans le dépôt `datacenter-market-v1`.*

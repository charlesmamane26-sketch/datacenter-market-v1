# Plan de mise en production — DatacenterMarket v1

> Établi le 10 juin 2026 à partir de l'audit de sécurité, du lancement local vérifié et du runbook DEPLOYMENT.md.
> Statut global : **l'app démarre et les 42 tests passent**, mais 4 correctifs de sécurité sont **bloquants avant ouverture publique**.

---

## Phase 0 — Correctifs bloquants (avant tout déploiement public)

| # | Correctif | Fichier | Effort |
|---|-----------|---------|--------|
| 0.1 | **IDOR `createPendingOrder`** : vérifier que le lead appartient à l'acheteur (`lead.userId === userId` ou `lead.userId === null` → rattacher le lead anonyme à l'acheteur en le réclamant). Sans cela, tout utilisateur authentifié peut commander/convertir le lead d'un autre. | `server/routers.ts:67-78` | ~30 min + test |
| 0.2 | **IDOR `leads.update`** : ajouter le contrôle owner-or-admin (même patron que `leads.get:205`). Actuellement tout utilisateur authentifié peut modifier le statut/l'offre de n'importe quel lead. | `server/routers.ts:215-229` | ~15 min + test |
| 0.3 | **`trust proxy` absent** : `app.set("trust proxy", 1)` en production (adapter au nombre de proxies), sinon le rate limiting de `leads.create` est contournable en spoofant `X-Forwarded-For`. | `server/_core/index.ts` | ~15 min |
| 0.4 | **Bornes Zod** : `.max()` sur toutes les strings de `leads.create` (aligner sur les colonnes DB), `.positive()` sur `monthlyBudget`, `.int().positive()` sur tous les IDs. | `server/routers.ts:144-156` et autres inputs | ~30 min |

Correctif déjà appliqué en local (à committer) : l'override pnpm `path-to-regexp@<0.1.13 → >=0.1.13` cassait Express 4 (résolution en 8.4.2, crash au boot `pathRegexp is not a function`). Corrigé en `>=0.1.13 <0.2.0` → 0.1.13.

## Phase 1 — Durcissement recommandé (semaine 1)

1. **Session 1 an sans révocation** : réduire la durée du JWT (quelques heures à 7 jours) ou ajouter un store de sessions révocables. Le logout actuel n'invalide rien côté serveur (`server/_core/sdk.ts`, `oauth.ts:41`).
2. **Cookie `sameSite: "none"`** : passer à `lax` (ou `strict` si le flux OAuth le permet) — réduit fortement la surface CSRF des mutations tRPC (`server/_core/cookies.ts`).
3. **Validation du `state` OAuth** : lier le `state` à un nonce signé/stocké côté serveur avant l'échange de code (`server/_core/oauth.ts:13-23`).
4. **Idempotence webhook Stripe** : court-circuiter si `order.paymentStatus === "succeeded"` ; idéalement, table `stripe_events` pour dédupliquer les rejeux (`server/stripe.ts:97-123`).
5. **`helmet`** : ajouter les headers de sécurité (CSP, HSTS, nosniff, frame-deny).
6. **Rate limiter** : éviction des clés vides (fuite mémoire de la `Map`) ; Redis si plusieurs instances.
7. **Dockerfile** : utilisateur non-root (`USER appuser`).
8. **JWT_SECRET** : valider ≥ 32 octets au démarrage.
9. **Corriger le placeholder `{{project_title}}`** dans le `<title>` de `client/index.html` et harmoniser 24h/72h sur la landing (todo.md Phase 7 disait tout passer à 72h).

## Phase 2 — Infrastructure (jours 1-3)

1. **Base de données** : MySQL managé ou TiDB Serverless (Docker local inutilisable sur cette machine, cf. CLAUDE.md). Activer les sauvegardes managées + TLS.
   - `pnpm db:push` puis `pnpm db:seed` (idempotent, 7 offres).
2. **Secrets runtime** : `DATABASE_URL`, `JWT_SECRET` (généré, 64 hex), `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `PORT`. Stockés dans le gestionnaire de secrets de l'hébergeur — jamais dans Git.
3. **Build args** : `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `VITE_FRONTEND_FORGE_API_*` (⚠️ inlinés dans le bundle JS public — vérifier que la clé Forge frontend est bien une clé publique).
4. **Hébergement** : conteneur Docker (image multi-stage existante) sur Fly.io / Railway / OVH ; ou pm2 + nginx sur VPS. Une seule instance au départ (rate limiter en mémoire).
5. **Cron** : `pnpm db:purge` quotidien 03:00 (RGPD, rétention 730 j) ; `pnpm db:cancel-stale` horaire.

## Phase 3 — Stripe en mode live (jours 3-5)

1. Créer le compte Stripe Anavim, activer les paiements.
2. **Mode test d'abord** : clé `sk_test_`, webhook `checkout.session.completed` vers `https://<domaine>/api/stripe/webhook`, vérifier le parcours complet avec `pnpm integration-check` puis une carte de test.
3. **Point à valider explicitement** (hypothèse non vérifiée, DEPLOYMENT.md §10) : le line-item one-time (setup fee) dans une session `mode: subscription` — tester avec une offre à setup fee > 0.
4. Basculer en clés live, refaire un paiement réel de bout en bout, vérifier la transition lead → `converted`.
5. Configurer la facturation/TVA Stripe Tax si applicable (clients B2B UE).

## Phase 4 — Observabilité et go-live (jours 5-7)

1. **Sentry** : créer le projet, renseigner `SENTRY_DSN` (l'intégration serveur est déjà câblée, commit `702f1fb`).
2. **Uptime monitoring** sur `/health` (UptimeRobot, BetterStack…).
3. **Télémétrie GPU** : décision produit — (a) masquer le panneau « Awaiting telemetry » du dashboard client pour le lancement, ou (b) lancer `pnpm db:telemetry --daemon` (données simulées — déconseillé face à de vrais clients), ou (c) brancher une vraie ingestion plus tard.
4. **DNS + TLS** : domaine, certificat (automatique chez la plupart des hébergeurs), forcer HTTPS.
5. **Checklist finale** : `pnpm check` ✅ · `pnpm test` ✅ (42/42) · `pnpm build` · `pnpm integration-check` contre la base de prod ✅ · paiement test ✅ · première connexion du owner (vérifie l'attribution admin via `OWNER_OPEN_ID`) ✅.

## Risques résiduels acceptés au lancement

- Rate limiting mono-instance (acceptable à 1 instance).
- Pas de tests frontend/E2E automatisés (parcours vérifié manuellement).
- Rôle admin mono-utilisateur via `OWNER_OPEN_ID` (suffisant tant qu'Anavim est seul opérateur ; prévoir une vraie gestion des rôles si l'équipe grandit).
- Audit logging absent (à ajouter avec la croissance).

# Datavocat

Plateforme d'analyse de jurisprudence pour avocats français. L'avocat décrit son
affaire en langage naturel ; le serveur interroge Judilibre et Légifrance,
calcule des statistiques déterministes sur les décisions réunies, et un modèle
rédige un rapport strictement adossé à ce corpus. Exports PDF, DOCX et Excel.

> **Principe directeur** : aucune référence ni aucun chiffre n'est produit par le
> modèle. Les statistiques sont calculées côté serveur, les décisions citées sont
> vérifiées après génération, et toute référence non trouvée dans le corpus est
> retirée du rapport. Voir [AUDIT.md](AUDIT.md) pour l'état détaillé du projet.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
npm run dev                  # http://localhost:3000
```

L'application démarre sans clé PISTE ni Voyage : les sources correspondantes
sont simplement absentes. En revanche, Supabase et Anthropic sont requis.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 3000) |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm run lint` | ESLint |
| `npm test` | Tests Vitest |
| `npm run test:watch` | Tests en mode watch |

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète et commentée.

Indispensables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

À ne pas oublier en production : `ADMIN_EMAILS` (liste des comptes
administrateurs) et `CRON_SECRET` (sans lui, la route cron refuse toute requête).

## Architecture

```
src/
├── app/
│   ├── (app)/        page principale (4 phases), historique, paramètres
│   ├── (auth)/       connexion, inscription (mot de passe)
│   ├── (legal)/      CGU, confidentialité, mentions légales
│   ├── admin/        validation des comptes, suivi des coûts
│   └── api/          analyze (streaming), clarify, chat, export, admin, cron
├── lib/
│   ├── judilibre/    récolte du corpus, statistiques, vérification, rerank
│   ├── legifrance/   articles de loi, CETAT, JURI, QPC, conventions
│   ├── claude/       client et prompt système
│   ├── supabase/     client / server / admin / gardes d'accès
│   └── parse-analysis.ts
└── middleware.ts     authentification et approbation (hors /api/)
```

Le pipeline d'analyse complet est décrit dans [CLAUDE.md](CLAUDE.md).

## Base de données

Migrations dans `supabase/migrations/`, à appliquer dans l'ordre. Quatre tables
vivantes : `analyses`, `api_usage`, `cabinets`, `profiles`.

⚠️ `scripts/setup-database.sql` est un dump d'un schéma antérieur (avant la
migration `00016`). **Ne pas l'exécuter** : il recréerait des tables supprimées
avec des policies trop permissives.

Après application des migrations, vérifier l'isolation :

```sql
select tablename, policyname, roles, cmd, qual
from pg_policies where schemaname = 'public' order by tablename;
```

Aucune ligne ne doit afficher `roles = {public}` avec `qual = true`.

## Contrôle d'accès

L'accès est soumis à une validation manuelle : un compte créé reste en attente
jusqu'à approbation par un administrateur depuis `/admin/approvals`.

L'approbation est stockée dans `app_metadata` (modifiable uniquement côté
serveur), jamais dans `user_metadata` que l'utilisateur peut réécrire.

Le middleware ne couvre pas `/api/` : **toute route API doit appeler
`requireUser()` ou `requireApprovedUser()`** (`src/lib/supabase/require-user.ts`).

## Tests

Les tests couvrent le cœur statistique — dénominateurs, seuils d'échantillon et
absence de statistiques fabriquées — ainsi que la vérification anti-hallucination.

```bash
npm test
```

## Déploiement

```bash
npx vercel --prod
```

`vercel.json` fixe la région sur `cdg1` (Paris) et déclare les budgets de durée
par route. Vérifier que le plan Vercel autorise le `maxDuration` de 300 s de
`/api/analyze` — sur le plan Hobby, la limite est de 60 s et le flux serait
interrompu en cours de génération.

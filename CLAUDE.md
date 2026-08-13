# Datavocat

Plateforme SaaS d'analyse de jurisprudence pour avocats français. L'avocat décrit son affaire en
langage naturel ; le serveur interroge Judilibre + Légifrance, calcule des statistiques
déterministes, et Claude rédige un rapport strictement adossé à ce corpus. Exports PDF/DOCX/XLSX.

> **Audit complet dans [AUDIT.md](AUDIT.md)** — constats par sévérité, roadmap, et surtout la liste
> des chiffres actuellement faux. À lire avant de toucher aux statistiques ou aux exports.

## Stack

- **Framework** : Next.js 16 (App Router) + TypeScript strict
- **UI** : Tailwind CSS v4 + shadcn/ui v4 (`@base-ui/react`, **PAS** `@radix-ui`)
- **BDD** : Supabase (PostgreSQL + Auth + RLS)
- **IA** : Claude via `@anthropic-ai/sdk` — Sonnet 4 (analyse), Haiku 4.5 (rerank, clarify, chat)
- **Jurisprudence** : Judilibre + Légifrance, tous deux via PISTE
- **Embeddings** : Voyage AI `voyage-law-2` (optionnel, rerank sémantique)
- **Export** : `docx`, `exceljs`, générateur PDF custom
- **Deploy** : Vercel + Supabase cloud

## Architecture réelle

⚠️ Le produit est **stateless** : les décisions ne sont pas stockées. La migration `00016` a
supprimé les tables `decisions`, `clients` et `stats_cache`. Seules `analyses`, `cabinets`,
`profiles` et `api_usage` subsistent — et `cabinets`/`profiles` sont fonctionnellement mortes.

```
src/
├── app/
│   ├── (app)/          page.tsx (flux principal 4 phases), historique/, rapport/, parametres/
│   ├── (auth)/         login, register (mot de passe, PAS magic link)
│   ├── (legal)/        cgu, confidentialite, mentions-legales
│   ├── admin/          approvals, costs  — protégé par ADMIN_EMAILS
│   └── api/
│       ├── analyze/    POST streaming — le cœur (486 l.)
│       ├── clarify/    questions de clarification (Haiku)
│       ├── chat/       chat de suivi (Haiku)
│       ├── export/     pdf | docx | xlsx
│       ├── admin/      approve, list-pending, costs, notify-signup
│       └── cron/       check-cph (ping hebdo Judilibre CPH)
├── lib/
│   ├── judilibre/      client.ts (récolte), stats.ts (calculs), verify.ts (anti-hallucination),
│   │                   rerank.ts (Haiku+Voyage), extractMontants.ts, enrichQueries.ts
│   ├── legifrance/     oauth.ts, client.ts (articles), jurisprudence.ts (CETAT),
│   │                   multifond.ts (JURI/CONSTIT/KALI), extractRefs.ts
│   ├── claude/         client.ts, analyze-prompt.ts (le prompt système, 280 l.)
│   ├── parse-analysis.ts   re-parse le markdown → ParsedAnalysis (1119 l.)
│   ├── api-usage/track.ts  coûts Claude (Voyage NON tracké)
│   └── supabase/       client | server | admin
└── middleware.ts       auth + approbation — ⚠️ exclut tout /api/
```

## Le pipeline d'analyse

```
POST /api/analyze
├─ auth Supabase + vérification d'ownership          analyze/route.ts:33-75
├─ Promise.all (avec timeouts) :
│   ├─ searchJudilibreForAnalysis()  race 60s        judilibre/client.ts:532
│   │   ├─ extraction mots-clés, détection matière/chambre/juridiction
│   │   ├─ vagues parallèles multi-pages (~200 requêtes PISTE)
│   │   ├─ merge CETAT (admin) + JURI (historique)
│   │   ├─ dédup + élargissements progressifs si < 30
│   │   └─ rerankDecisions()  Haiku + Voyage 50/50   judilibre/rerank.ts:227
│   └─ searchJusticeDatasets()  race 8s              datagouv/mcp-client.ts
├─ computeCorpusStats()  → stats déterministes       judilibre/stats.ts:283
├─ formatStatsForPrompt() → bloc « FAITS VÉRIFIÉS »  judilibre/stats.ts:630
├─ enrichissement Légifrance : articles, QPC, KALI   analyze/route.ts:124-204
├─ anthropic.messages.stream()  Sonnet, 32k max      analyze/route.ts:240
├─ verifyAndCleanMarkdown()  supprime les refs       judilibre/verify.ts:372
│                            hors corpus
└─ UPDATE analyses (response, judilibre_corpus, verification)
```

Le front consomme le stream, extrait les balises `[STEP:...]` in-band, puis re-parse le markdown
via `parseAnalysisResponse()`.

## Invariants métier — ne pas casser

1. **Anti-hallucination** : Claude ne peut citer aucune décision absente du corpus ni aucun chiffre
   absent du bloc FAITS VÉRIFIÉS. `verify.ts` supprime après coup toute phrase contenant une
   référence non vérifiable.
2. **Les stats sont calculées côté serveur**, jamais par le modèle. Claude les récite.
3. **Art. 33 loi 2019-222** : interdiction absolue de profiler les magistrats. Appliquée dans le
   prompt ET par `stripMagistratNames()` (`judilibre/client.ts:44`).
4. **Monopole du conseil (loi 71-1130)** : jamais « je recommande » / « vous devez ». Vocabulaire
   d'observation imposé par le prompt.
5. **Hiérarchie 4 catégories mutuellement exclusives** : 1er degré / CA / Cassation / Conseil d'État.
   Leur somme doit égaler le total du corpus.

## Pièges connus

- **Recharts v3** : ne jamais typer les callbacks (`formatter={(v) => ...}`, pas `(v: number)`).
  Incompatible Tremor. (Note : Recharts n'est plus utilisé que par `slides.tsx`, qui est du code mort.)
- **shadcn/ui v4** : `@base-ui/react`, pas de prop `asChild`.
- **Supabase** : `Database` doit être un `type`, pas une `interface`. Toutes les tables ont besoin
  de `Relationships: []`.
- **`src/types/database.ts` est désynchronisé** : `api_usage`, `judilibre_corpus` et `verification`
  manquent → le code utilise des casts `as unknown`. Régénérer avant d'y toucher.
- **Zod v4** : importer depuis `"zod"` (pas `"zod/v4"`).
- **`scripts/setup-database.sql` est un schéma mort** (état pré-00016). Ne jamais l'exécuter.
- **Le middleware exclut `/api/`** : toute route API doit vérifier l'auth elle-même.

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=        NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       ANTHROPIC_API_KEY=
PISTE_KEY_ID=                    PISTE_CLIENT_ID=  PISTE_CLIENT_SECRET=
VOYAGE_API_KEY=                  # optionnel — rerank sémantique
RESEND_API_KEY=                  EMAIL_FROM=
ADMIN_EMAILS=                    # liste séparée par virgules — source de vérité de l'admin
CRON_SECRET=                     # ⚠️ si absent, le cron est public
ANALYZE_MODEL= CHAT_MODEL= RAPPORT_MODEL= USD_EUR_RATE=
NEXT_PUBLIC_APP_URL=
```

Il n'existe pas de `.env.example` — à créer.

## Commandes

```bash
npm run dev      # port 3000
npm run build    # Turbopack
npm run lint
npx vercel --prod
```

Pas de tests, pas de CI, pas de script `typecheck`.

## Règles de véracité — à ne jamais enfreindre

Un audit d'août 2026 a trouvé plusieurs chiffres faux publiés à l'avocat. Ils sont corrigés ;
ces règles empêchent leur retour. Elles sont verrouillées par les tests de
`src/lib/judilibre/stats.test.ts`.

1. **Ne jamais écrire « X % de chances de succès. »** Le taux mesure la part d'issues
   favorables *dans le corpus réuni* — pas une probabilité. Judilibre n'indique pas quelle
   partie a formé le recours, et le corpus n'est pas un échantillon aléatoire. Tout affichage
   du taux porte son effectif (n), sa marge d'erreur, et sa réserve **à côté du chiffre**.
2. **Ne jamais réécrire un chiffre dans le markdown généré.** Corriger un effectif sans
   recalculer les pourcentages associés fabrique une erreur. En cas d'incohérence : signaler,
   pas corriger.
3. **Ne jamais inventer une donnée absente de la source.** Pas de chambre par défaut, pas de
   date reconstruite. Une donnée manquante reste manquante.
4. **Exclure des dénominateurs les décisions sans dispositif lisible** — les compter fait
   chuter mécaniquement tous les taux.
5. **Ne pas publier de taux sous 15 décisions**, ni de fourchette de montants sous 5.
6. **Les `themes` Judilibre sont un classement documentaire**, pas les moyens plaidés : les
   présenter comme des « taux par argument » est trompeur.
7. **Aucune variation par cour d'appel** : Judilibre n'expose pas le ressort.
8. **Aucun taux de condamnation article 700** : les sommaires ne permettent pas de le calculer.
9. **Aucun chiffre en dur en façade** (ex. un compteur de décisions) : soit il est calculé,
   soit il n'est pas affiché.

## Contrôle d'accès

Le middleware **ne couvre pas `/api/`**. Toute route API doit appeler `requireUser()` ou
`requireApprovedUser()` (`src/lib/supabase/require-user.ts`) — les routes consommant du budget
utilisent la seconde, plus `checkRateLimit()`.

L'approbation vit dans `app_metadata` (serveur uniquement), **jamais** dans `user_metadata`
que l'utilisateur peut réécrire.

En base : ne jamais créer de policy `USING (true)` sans clause `TO`. Elle s'appliquerait à
`PUBLIC` et annulerait toutes les policies d'isolation (elles se combinent en OU).

## État du projet

**Solide** : discipline TypeScript (0 `any`, 0 `@ts-ignore`, 0 catch vide), anti-hallucination
serveur, conformité déontologique (art. 33, monopole du conseil), autorisation admin en triple
garde, hygiène des secrets, avertissements méthodologiques du dashboard.

**Corrigé en août 2026** (5 commits, détail dans [AUDIT.md](AUDIT.md) §8) : faille RLS,
routes LLM ouvertes, auto-approbation, chiffres faux, rerank cassé, ~2 800 lignes de code mort,
accessibilité, pages légales. Ajout de Vitest (22 tests), d'une CI et de quotas par utilisateur.

**Reste à faire** : rétention RGPD non implémentée ; découpage des monolithes
(`page.tsx` 1451 l., `evidence-table.tsx`, `dashboard.tsx` — 18 erreurs de lint y sont
préexistantes, d'où le `continue-on-error` en CI) ; archivage de `scripts/setup-database.sql` ;
sort à trancher pour `cabinets`/`profiles`, aujourd'hui morts.

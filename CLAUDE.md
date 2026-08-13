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

## État du projet — l'essentiel

**Solide** : discipline TypeScript (0 `any`, 0 `@ts-ignore`, 0 catch vide sur 25 000 l.),
architecture anti-hallucination serveur, conformité déontologique, autorisation admin en triple
garde, hygiène des secrets (rien n'a jamais été commité), avertissements méthodologiques du
dashboard (remarquables).

**À traiter en priorité** (détail et roadmap dans [AUDIT.md](AUDIT.md)) :
1. **Exposition** — policies RLS `USING (true)` qui annulent l'isolation ; `/api/chat` et
   `/api/clarify` non authentifiés ; `approved` dans `user_metadata` donc auto-attribuable.
2. **Véracité des chiffres** — `patchAnnouncedCount` réécrit les effectifs sans recalculer les % ;
   le « taux de succès » mesure la propension à réformer, pas les chances de gagner ; plusieurs
   statistiques sont des artefacts de parsing ; des données sont fabriquées (chambre « soc » par
   défaut) ; « 562 487 décisions » est hardcodé.
3. **Absence de filet** — zéro test sur `stats.ts` / `verify.ts` / `parse-analysis.ts`, ce qui
   laisse des défaillances muettes (rerank Haiku tronqué) vivre indéfiniment.

**~2 800 lignes de code mort**, dont `slides.tsx` (2217 l., jamais importé) et `/api/rapport`
(route morte mais exposée, avec injection de prompt).

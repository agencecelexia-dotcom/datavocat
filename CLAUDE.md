# Datavocat

Plateforme SaaS d'analyse jurimetrique pour avocats francais. L'avocat decrit son affaire en langage naturel, l'IA interroge la jurisprudence (Judilibre + data.gouv.fr) et produit statistiques, recommandations strategiques, et exports professionnels.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui v4 (@base-ui/react, PAS @radix-ui)
- **Charts**: Recharts v3 (PAS Tremor — incompatible React 19)
- **Backend**: Next.js API Routes (streaming)
- **BDD**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **IA**: Claude API (Sonnet 4) via @anthropic-ai/sdk
- **Jurisprudence**: API Judilibre via PISTE OAuth2 (~480K arrets Cass. + 82K CA)
- **Open data**: API data.gouv.fr (source secondaire)
- **Async**: QStash (Upstash) pour extraction PDF
- **Export**: docx (DOCX), generateur PDF minimal custom
- **Deploy**: Vercel + Supabase cloud

## Architecture

```
src/
├── app/
│   ├── layout.tsx                  # Fonts: DM Serif Display, Inter, JetBrains Mono
│   ├── (auth)/                     # Login/register (magic link)
│   ├── (app)/
│   │   ├── page.tsx                # Page principale conversationnelle (4 phases: input→clarify→analyzing→done)
│   │   ├── decisions/              # CRUD decisions de justice
│   │   ├── statistiques/           # Stats SQL (juridictions, motifs, chronologie)
│   │   ├── mon-affaire/            # Scoring similarite
│   │   ├── historique/             # Historique des analyses
│   │   └── rapport/[id]/           # Rapports strategiques
│   └── api/
│       ├── analyze/                # POST: streaming Claude + Judilibre + data.gouv
│       ├── clarify/                # POST: questions de clarification (non-streaming)
│       ├── export/pdf/             # POST: export PDF
│       ├── export/docx/            # POST: export DOCX
│       ├── decisions/              # CRUD decisions
│       ├── extract/                # Queue extraction PDF via QStash
│       ├── extract/process/        # Callback QStash (extraction Claude)
│       ├── stats/                  # Stats agregees SQL
│       ├── mon-affaire/            # Scoring similarite SQL
│       ├── rapport/                # Generation rapport IA
│       ├── analyses/               # Historique analyses
│       ├── upload/                 # Upload PDF vers Supabase Storage
│       └── import/datagouv/        # Import depuis data.gouv.fr
├── components/
│   ├── ui/                         # Primitives shadcn/ui
│   ├── layout/                     # Sidebar (navy) + Header
│   ├── analysis/
│   │   ├── dashboard.tsx           # Dashboard analytique (gauge, KPIs, charts)
│   │   └── slides.tsx              # Presentation slides (navigation, fullscreen)
│   ├── decisions/                  # Table, review extraction, upload
│   ├── stats/                      # Stat cards, charts
│   └── mon-affaire/                # Formulaire + probabilites
├── lib/
│   ├── supabase/                   # client.ts, server.ts, admin.ts
│   ├── claude/                     # client.ts, analyze-prompt.ts, extraction-prompt.ts, rapport-prompt.ts
│   ├── judilibre/client.ts         # API Judilibre via PISTE OAuth2
│   ├── datagouv/client.ts          # API data.gouv.fr
│   ├── extraction/service.ts       # Extraction PDF via Claude
│   ├── validators/decision.ts      # Schemas Zod (39 champs)
│   ├── parse-analysis.ts           # Parse markdown → ParsedAnalysis (sources, fiabilite, stats)
│   └── utils.ts
├── hooks/                          # use-decisions, use-stats, use-extraction-status
├── types/                          # database.ts (Supabase types), decision.ts, stats.ts
└── middleware.ts                   # Auth guard + session refresh
```

## Conventions importantes

### shadcn/ui v4
- Utilise `@base-ui/react`, PAS `@radix-ui`. Pas de prop `asChild`.
- `npx shadcn@latest add <component>` pour ajouter des composants.

### Recharts v3
- **Ne jamais typer les callbacks Tooltip/XAxis** : `formatter={(v) => ...}` PAS `formatter={(v: number) => ...}` (erreur de type sinon).
- Incompatible avec Tremor — ne pas installer @tremor/react.

### Supabase
- Le type `Database` doit etre un `type` PAS une `interface` (pour GenericSchema).
- Toutes les tables doivent avoir `Relationships: []`.

### Zod
- Package zod v4, mais importer depuis `"zod"` (pas `"zod/v4"`) pour compatibilite react-hook-form.

### QStash
- Lazy-loaded pour eviter les erreurs de build quand les env vars manquent.
- En dev, appelle directement l'endpoint process au lieu de publier dans QStash.

### Anthropic SDK
- Utiliser `.filter(b => b.type === "text")` puis recheck type dans `.map()` — pas de type predicates sur ContentBlock.

### Palette de couleurs
- Navy: `#1e3a5f` (primary)
- Gold: `#c9a96e` (accent)
- Emerald: `#2d6a4f` (success)
- Bordeaux: `#9b2226` (danger)
- Amber: `#ca6702` (warning)
- Fond: warm white `#fafaf9`

### Fonts
- Titres: DM Serif Display (`font-serif`)
- Corps: Inter (`font-sans`)
- Code/references: JetBrains Mono (`font-mono`)

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
PISTE_CLIENT_ID=             # OAuth2 client ID PISTE
PISTE_CLIENT_SECRET=         # OAuth2 client secret PISTE
PISTE_KEY_ID=                # API key PISTE (header KeyId)
PISTE_SANDBOX=true           # "true" pour sandbox, supprimer pour prod
QSTASH_TOKEN=                # Optionnel (extraction async)
VOYAGE_API_KEY=              # Optionnel — embeddings semantique voyage-law-2 (Niveau 4 jurimetrie)
NEXT_PUBLIC_APP_URL=
```

## Commandes

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Build production (Turbopack)
npx vercel --prod    # Deploy Vercel
```

## Flux principal

1. Avocat saisit sa demande (page principale)
2. Claude genere 3-5 questions de clarification (`/api/clarify`)
3. L'avocat repond (ou skip)
4. Recherche parallele Judilibre + data.gouv.fr (`/api/analyze`)
5. Claude analyse en streaming avec le contexte jurisprudentiel
6. Resultat: rapport texte + dashboard visuel + slides
7. Sources ECLI/pourvoi cliquables vers Legifrance
8. Export PDF/DOCX

## Base de donnees (Supabase)

7 migrations SQL dans `supabase/migrations/`:
- cabinets, profiles, decisions (39+ colonnes, 5 categories), stats_cache, views SQL, fonction scoring, RLS multi-tenant

## Points d'attention

- `PISTE_SANDBOX=true` en cours — passer a `false` pour production
- Les decisions Judilibre sont la source prioritaire (reelles et verifiables)
- Ne jamais inventer de references ECLI ou de statistiques
- L'indice de fiabilite (0-100) est calcule dans `parse-analysis.ts` a partir de: nb sources, echantillon, Judilibre, confiance

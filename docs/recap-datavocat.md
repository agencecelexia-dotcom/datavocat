# Datavocat — Récapitulatif complet

> Plateforme SaaS d'analyse jurimétrique pour avocats français.
> L'avocat décrit son affaire en langage naturel ; l'IA interroge la jurisprudence (Judilibre, Légifrance, data.gouv.fr) et restitue statistiques, recommandations stratégiques et exports professionnels.

---

## 1. Pitch en une phrase

**Datavocat transforme une question juridique formulée en français courant en une analyse jurimétrique chiffrée, sourcée et exportable, en moins de deux minutes.**

---

## 2. Le problème

- Un avocat passe en moyenne plusieurs heures à fouiller Légifrance, Judilibre, doctrine, bases internes pour estimer les chances d'une procédure.
- Les statistiques de jurisprudence (taux de succès, montants accordés, délais) sont éparses, non agrégées, peu exploitables en l'état.
- Les outils existants sont soit des moteurs de recherche (Doctrine, Lexis), soit des bases brutes (Judilibre) — aucun ne produit une **analyse stratégique chiffrée prête à présenter au client**.

## 3. La proposition de valeur

| Avant Datavocat                                    | Avec Datavocat                                              |
| -------------------------------------------------- | ----------------------------------------------------------- |
| 3 à 6 heures de recherche manuelle                 | 90 secondes de génération automatique                       |
| Recherches éparpillées sur 4–5 sources             | Recherche unifiée Judilibre + Légifrance + data.gouv.fr     |
| Pas de chiffrage des chances                       | Indice de fiabilité + taux de succès calculés sur le corpus |
| Pas de livrable client                             | Export PDF / DOCX / XLSX prêt à transmettre                 |
| Citations à reconstruire à la main                 | ECLI / pourvoi cliquables vers Légifrance                   |

---

## 4. Parcours utilisateur

1. **Saisie libre** — l'avocat décrit l'affaire en langage naturel sur la page principale.
2. **Clarification IA** — Claude pose 3 à 5 questions ciblées (juridiction, demandeur, montants, qualité des parties, date des faits…). L'avocat peut répondre ou skipper.
3. **Recherche parallèle** — Judilibre (≈ 480 000 arrêts Cour de cassation + 82 000 cours d'appel), Légifrance (codes, articles, jurisprudence multifond), data.gouv.fr (open data justice).
4. **Analyse en streaming** — Claude Sonnet 4 reçoit le corpus pertinent et rédige la note jurimétrique en streaming token-par-token.
5. **Restitution triple** :
   - **Texte structuré** (synthèse, statistiques, recommandations stratégiques)
   - **Dashboard analytique** (jauge de fiabilité, KPI, graphiques Recharts)
   - **Slides** mode présentation client (carrousel, fullscreen)
6. **Sources cliquables** — chaque ECLI / pourvoi renvoie à la décision sur Légifrance.
7. **Exports** — PDF, DOCX, XLSX en un clic.
8. **Historique** — toutes les analyses passées sont retrouvables et chat de suivi disponible.

---

## 5. Architecture technique

### Stack

| Couche             | Technologie                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Framework          | Next.js 16 (App Router) + TypeScript + React 19.2                  |
| UI                 | Tailwind CSS v4 + shadcn/ui v4 (sur `@base-ui/react`, pas Radix)   |
| Charts             | Recharts v3                                                        |
| Backend            | Next.js API Routes (streaming SSE)                                 |
| Base de données    | Supabase (PostgreSQL + Auth + Storage + RLS multi-tenant)          |
| IA                 | Claude Sonnet 4 via `@anthropic-ai/sdk` 0.78                       |
| Jurisprudence      | API Judilibre via PISTE (OAuth2)                                   |
| Légal              | API Légifrance multifond (jurisprudence + codes)                   |
| Open data          | API data.gouv.fr (et MCP client interne)                           |
| Async              | QStash (Upstash) pour extraction PDF                               |
| Email              | Resend (notifications, approbations, feedback)                     |
| Exports            | `docx` 9.6, `exceljs` 4.4, `@react-pdf/renderer` 4.3               |
| Validation         | Zod v4 + react-hook-form 7.71                                      |
| Déploiement        | Vercel + Supabase Cloud                                            |

### Arborescence

```
src/
├── app/
│   ├── (app)/                        # Pages authentifiées
│   │   ├── page.tsx                  # Page principale conversationnelle
│   │   ├── historique/               # Liste + détail des analyses passées
│   │   ├── rapport/[id]/             # Rapport stratégique
│   │   └── parametres/               # Profil, cabinet, mot de passe
│   ├── (auth)/                       # login / register
│   ├── (legal)/                      # CGU / confidentialité / mentions légales
│   ├── admin/                        # Dashboard admin (approvals, costs)
│   ├── pending-approval/             # Page d'attente d'approbation
│   └── api/                          # Routes serveur (voir plus bas)
├── components/
│   ├── analysis/
│   │   ├── dashboard.tsx             # Dashboard analytique (40 Ko)
│   │   └── slides.tsx                # Présentation slides (77 Ko)
│   ├── decisions/                    # Tables, review extraction, upload
│   ├── stats/                        # Cards, charts agrégés
│   ├── layout/                       # Sidebar (navy) + header
│   └── ui/                           # Primitives shadcn
├── lib/
│   ├── claude/                       # client + prompts (analyze, extraction, rapport)
│   ├── judilibre/                    # client, enrichQueries, rerank, stats, verify
│   ├── legifrance/                   # client, oauth, jurisprudence, multifond
│   ├── datagouv/                     # client + MCP wrapper
│   ├── supabase/                     # client / server / admin / auth-helper
│   ├── api-usage/track.ts            # Tracking coût Claude (tokens, USD)
│   ├── email/                        # send.ts (Resend) + templates
│   ├── extraction/service.ts         # Extraction PDF via Claude
│   ├── validators/decision.ts        # Schémas Zod (39 champs)
│   └── parse-analysis.ts             # Parse markdown → ParsedAnalysis
├── hooks/                            # use-decisions, use-stats, use-extraction-status
├── types/                            # database.ts, decision.ts, stats.ts
└── middleware.ts                     # Auth guard + refresh session
```

### API Routes

| Route                          | Méthode | Rôle                                                              |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| `/api/analyze`                 | POST    | **Cœur du produit** : streaming Claude + Judilibre + data.gouv    |
| `/api/clarify`                 | POST    | Génère 3-5 questions de clarification                             |
| `/api/chat`                    | POST    | Questions de suivi sur une analyse existante                      |
| `/api/rapport`                 | POST    | Génère un rapport stratégique IA                                  |
| `/api/analyses`                | GET     | Historique (paginé)                                               |
| `/api/analyses/[id]`           | GET     | Détail d'une analyse                                              |
| `/api/feedback`                | POST    | Envoie feedback / bug à l'admin (Resend)                          |
| `/api/export/pdf`              | POST    | Export PDF                                                         |
| `/api/export/docx`             | POST    | Export Word                                                        |
| `/api/export/xlsx`             | POST    | Export Excel                                                       |
| `/api/admin/list-pending`      | GET     | Liste des comptes en attente                                      |
| `/api/admin/approve`           | POST    | Approuve / révoque un compte (envoie email)                       |
| `/api/admin/costs`             | GET     | Agrégats consommation API (mois en cours, top users, par opération) |
| `/api/admin/notify-signup`     | POST    | Notification interne à l'inscription                              |
| `/auth/callback`               | GET     | Callback OAuth / magic-link Supabase                              |

### Base de données

18 migrations SQL (`supabase/migrations/`) :

- **`cabinets`** — multi-tenant, plan free/pro/enterprise
- **`profiles`** — lié à `auth.users`, rôle (avocat / admin / collaborateur), cabinet_id, trigger auto-création
- **`decisions`** — ~70 champs : juridiction, accord, recevabilité, issue, montants, appel, anonymisation
- **`analyses`** — historique : query, response JSON, status (pending/streaming/done/error), corpus verification
- **`api_usage`** — tracking coût : user, modèle, opération, tokens (input/output/cache), `cost_usd`
- **`v_stats_par_juridiction`** — vue agrégée : taux de succès, délais, montants moyens
- **`v_stats_par_motif`** — stats par moyen invoqué
- **RLS** — isolation utilisateur / cabinet sur toutes les tables
- **Indexes full-text** sur `decisions`
- **Storage** — bucket pour les PDF
- **Seed** — référentiels (codes, juridictions)

---

## 6. Briques IA

### Claude (Anthropic)

- **Modèle** : Claude Sonnet 4 (`claude-sonnet-4-20250514`), surchargeable via `ANALYZE_MODEL`.
- **3 prompts spécialisés** dans `src/lib/claude/` :
  - `analyze-prompt.ts` (22 Ko) — prompt système jurimétrique structuré
  - `extraction-prompt.ts` — extraction métadonnées d'une décision
  - `rapport-prompt.ts` — rapport stratégique
- **Streaming** SSE jusqu'au navigateur pour UX en temps réel.
- **Cost tracking** : chaque appel est journalisé dans `api_usage` (tokens + USD), agrégé dans `/admin/costs`.

### Judilibre (Cour de cassation)

- Accès via PISTE OAuth2 (`PISTE_CLIENT_ID/SECRET/KEY_ID`), sandbox configurable.
- Pipeline : `enrichQueries` (synonymes / termes juridiques) → `client.search` → `rerank` → `extractMontants` → `verify`.
- Source **prioritaire** car réelle et vérifiable.

### Légifrance

- OAuth 2 dédié + endpoint multifond (jurisprudence + codes).
- Extraction des références d'articles dans les décisions (`extractRefs.ts`).

### data.gouv.fr

- Source secondaire pour open data justice.
- Wrapper MCP interne (`mcp-client.ts`).

### Indice de fiabilité

Calculé dans `parse-analysis.ts` à partir de :

- nombre de sources réelles
- taille de l'échantillon
- présence de Judilibre (pondération forte)
- niveau de confiance auto-déclaré par Claude

Score 0–100, affiché en jauge sur le dashboard.

---

## 7. Design system

| Token       | Valeur     | Usage                              |
| ----------- | ---------- | ---------------------------------- |
| Navy        | `#1e3a5f`  | Primary, sidebar, titres slides    |
| Navy light  | `#2a4f7a`  | Dégradés                           |
| Gold        | `#c9a96e`  | Accent, KPI mis en avant           |
| Emerald     | `#2d6a4f`  | Succès, taux positifs              |
| Bordeaux    | `#9b2226`  | Danger, taux d'échec               |
| Amber       | `#ca6702`  | Warning, vigilance                 |
| Fond        | `#fafaf9`  | Warm white                         |

**Typographie** : DM Serif Display (titres), Inter (corps), JetBrains Mono (codes / ECLI).

---

## 8. Sécurité & conformité

- **Auth Supabase** — magic link + email/password, middleware de refresh session.
- **RLS multi-tenant** — chaque utilisateur ne voit que les analyses / décisions de son cabinet.
- **Approbation manuelle** — nouveaux comptes en attente jusqu'à validation admin (`/admin/approvals`).
- **Anonymisation** — colonnes dédiées dans `decisions` pour masquer juges / parties si besoin.
- **Pages légales** — CGU, confidentialité, mentions légales déjà publiées (`(legal)/*`).
- **Cost guard** — tracking complet de la consommation Claude pour éviter les dérives.

---

## 9. Variables d'environnement

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude
ANTHROPIC_API_KEY=
ANALYZE_MODEL=claude-sonnet-4-20250514   # optionnel

# Judilibre via PISTE
PISTE_CLIENT_ID=
PISTE_CLIENT_SECRET=
PISTE_KEY_ID=
PISTE_SANDBOX=true                       # passer à false pour prod

# Légifrance
NEXT_PUBLIC_LEGIFRANCE_*

# Async + email
QSTASH_TOKEN=
RESEND_API_KEY=
EMAIL_FROM="Datavocat <no-reply@datavocat.fr>"
ADMIN_EMAIL=
ADMIN_EMAILS=                            # CSV des emails admin

# App
NEXT_PUBLIC_APP_URL=
VOYAGE_API_KEY=                          # optionnel — embeddings semantiques
```

---

## 10. Roadmap implicite (lue dans le code)

- ✅ Analyse jurimétrique streaming (live)
- ✅ Dashboard + slides + exports PDF/DOCX/XLSX
- ✅ Historique + chat de suivi
- ✅ Multi-tenant + RLS + approbation manuelle
- ✅ Tracking coût API
- 🟡 Embeddings sémantiques (`voyage-law-2`) — préparé, peu utilisé
- 🟡 Extraction PDF asynchrone via QStash — en place mais à industrialiser
- 🔴 `PISTE_SANDBOX=true` — à basculer en prod
- 🔴 Pas de tests automatisés visibles dans le repo

---

## 11. Argumentaire commercial (3 punchlines)

1. **« Une plaidoirie chiffrée en 90 secondes. »** Datavocat passe de la question du client au rapport stratégique sourcé sans toucher Légifrance.
2. **« Vos sources, pas nos hallucinations. »** Toutes les statistiques s'appuient sur des décisions réelles Judilibre / Légifrance, ECLI cliquables, indice de fiabilité 0–100 affiché.
3. **« Du SaaS, pas un assistant. »** Multi-utilisateurs par cabinet, exports natifs, historique persistant, tracking de la consommation IA — c'est un outil de production, pas une démo de chatbot.

---

## 12. Chiffres clés à retenir pour la slide finale

- ~ **480 000** arrêts Cour de cassation indexés via Judilibre
- ~ **82 000** arrêts cours d'appel
- **39+ champs** structurés extraits par décision
- **18 migrations SQL** versionnées
- **Indice de fiabilité 0–100** sur chaque analyse
- **3 formats d'export** : PDF, DOCX, XLSX
- **Stack** : Next 16 + React 19 + Claude Sonnet 4 + Supabase

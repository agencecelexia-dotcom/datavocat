# Audit de couverture juridique — Datavocat

> Document produit le 23 avril 2026.
> Objectif : cartographier les sources juridiques gratuites exploitables pour
> étendre la couverture de Datavocat au-delà du duo Judilibre/data.gouv actuel,
> avec URL canonique cliquable obligatoire pour chaque décision.

---

## 1. État des lieux

### 1.1 Sources actuellement branchées

| Source | Module | Accès | Permalien stocké ? | Fraîcheur |
|---|---|---|---|---|
| **Judilibre** (Cour de cassation + CA) | `src/lib/judilibre/client.ts` | PISTE — header `KeyId` | Construit dynamiquement via `buildSourceUrl()` depuis ECLI/pourvoi | quotidienne |
| **data.gouv.fr** (datasets juridiques) | `src/lib/datagouv/client.ts` + `mcp-client.ts` | API REST publique | Non stocké, dataset metadata uniquement | variable |

### 1.2 Architecture actuelle — constat clé

**Datavocat ne stocke pas les décisions en base.** La table `decisions` a été supprimée dans la migration `00016_drop_clients_decisions_stats.sql`. Le flow courant est :

1. L'utilisateur saisit sa question
2. Le backend appelle Judilibre + data.gouv **en temps réel** (~60 décisions max)
3. Claude analyse et rédige un rapport markdown
4. Seul le `response` markdown et le `query` sont persistés dans la table `analyses`
5. Les liens vers les sources sont reconstruits côté front par `buildSourceUrl()` en parsant les ECLI/pourvois cités dans la réponse

**Conséquence pour l'extension** :
- Option A — **rester stateless** : ajouter des clients API supplémentaires (ArianneWeb, HUDOC, EUR-Lex, CNIL…) appelés en live au moment de l'analyse. Simple mais limite la vélocité (latence accumulée, quotas multiples, pas de recherche vectorielle cross-sources).
- Option B — **basculer vers ingestion + indexation** : recréer une table `decisions` avec `pgvector` + `tsvector`, alimentée par des workers n8n/cron. C'est ce que suggère le prompt initial (Supabase + pgvector + full-text). Beaucoup plus puissant mais refonte significative.

**Ma recommandation** : hybride. Garder le live pour Judilibre (fraîcheur, pas de stock), mais **ingérer les fonds "dumpés" en base** (Conseil d'État, HUDOC, EUR-Lex, sanctions autorités) — ces sources ne proposent pas d'API temps réel performante, l'ingestion est la seule voie.

### 1.3 Construction d'URL canonique actuelle

`src/lib/parse-analysis.ts:93` — `buildSourceUrl()` (exportée) :
- ECLI → `https://www.legifrance.gouv.fr/search/all?query={ECLI}...` (fix récent pour contourner le crash de `/juri/id/{ECLI}`)
- Pourvoi → même format search/all
- Fallback → search/all avec la référence brute

**Limite** : repose sur le parsing d'ECLI/pourvoi dans le markdown Claude. Si Claude ne cite pas, pas de lien. En architecture avec ingestion, on stocke le `source_url` directement à l'ingestion — beaucoup plus fiable.

### 1.4 Frustrations actuelles identifiables (hypothèses — à valider avec toi)

1. **Pas de Conseil d'État** — le contentieux administratif est invisible. Or c'est la 3e juridiction la plus demandée.
2. **Pas de CEDH** — les avocats en droit des étrangers, libertés, pénal européen n'ont pas leur jurisprudence-pivot.
3. **Pas d'autorités** (CNIL, AMF, ADLC…) — les sanctions en conformité/RGPD ne sont pas là.
4. **Dépendance PISTE unique** — coupure ou changement de CGU = service à l'arrêt.
5. **Doublons Légifrance/Judilibre** — les deux via PISTE exposent en partie les mêmes décisions (Cass. publiées).
6. **Pas de permalien stable** pour certaines décisions Judilibre anciennes (avant ECLI).

---

## 2. Tableau de synthèse des sources cibles

| # | Source | Volume | Type d'accès | Permalien public | Difficulté | Valeur | Bucket |
|---|---|---:|---|:---:|:---:|:---:|---|
| 1 | **Conseil d'État + CAA + TA** (opendata.justice-administrative.fr) | 270k + 2M | Dumps ZIP/XML quotidiens | ✅ ArianneWeb direct | 2 | 5 | 🟢 Quick win |
| 2 | **HUDOC (CEDH)** | ~65k arrêts | API non officielle JSON | ✅ `hudoc.echr.coe.int/eng?i={id}` | 3 | 5 | 🟠 Stratégique |
| 3 | **EUR-Lex Cellar** (CJUE + directives + règlements) | 1M+ | REST + SPARQL **officiels** | ✅ `eur-lex.europa.eu/eli/...` | 2 | 4 | 🟢 Quick win |
| 4 | **CNIL sanctions** | ~300/an + historique | Scraping + dataset data.gouv | ✅ `cnil.fr/fr/deliberation/...` | 2 | 3 | 🟢 Quick win |
| 5 | **AMF Commission sanctions** | ~50/an | Scraping | ✅ `amf-france.org/.../Decisions-de-la-commission...` | 3 | 3 | 🟠 Stratégique |
| 6 | **Autorité de la concurrence (ADLC)** | ~100 décisions/an | Dataset data.gouv + scraping | ✅ `autoritedelaconcurrence.fr/...` | 3 | 2 | 🟡 Nice-to-have |
| 7 | **ARCOM** | ~30 décisions/an | Scraping | ✅ `arcom.fr/se-documenter/...` | 3 | 2 | 🟡 Nice-to-have |
| 8 | **HATVP** (déclarations) | faible | Dataset data.gouv | ⚠️ permalien pas toujours fiable | 3 | 1 | 🟡 Nice-to-have |
| 9 | **BODACC** (annonces commerciales) | millions | API open data officielle | ✅ `bodacc.fr/annonce/detail-annonce/...` | 2 | 3 | 🟠 Stratégique |
| 10 | **INPI RNE** (registre entreprises) | 6M entreprises | API PISTE OAuth2 | ⚠️ pas un permalien "décision" | 2 | 2 | 🟡 Nice-to-have |
| 11 | **Légifrance via PISTE** (codes + JO + QPC) | énorme | API PISTE | ✅ `legifrance.gouv.fr/jorf/id/...` | 1 | 4 | 🟢 Quick win |
| 12 | **Tribunaux de commerce** (Infogreffe) | payant en pratique | pas gratuit | ❌ | — | — | Écarté |
| 13 | **MCP `jmtanguy/droit-francais-mcp`** | fork possible | MCP prêt à l'emploi | ✅ hérite permaliens | 1 | 3 | 🟢 Quick win |
| 14 | **Jurisprudence dumps** (antoinejeannot/jurisprudence) | actualisé 72h | Dumps GitHub Actions | ✅ ECLI | 1 | 3 | 🟢 Quick win |

---

## 3. Fiches détaillées par source

### 3.1 🟢 Conseil d'État + CAA + TA — opendata.justice-administrative.fr

**Organisme** : Conseil d'État (DSI) · **Licence** : Etalab 2.0

**Périmètre** :
- **Conseil d'État** : décisions depuis le 30 septembre 2021 (plus rétrospective)
- **9 Cours administratives d'appel** : depuis le 31 mars 2022
- **42 Tribunaux administratifs** : depuis le 30 juin 2022
- Soit **~270 000 décisions CE** (base ArianneWeb) + **~2 millions TA/CAA** à terme
- Profondeur : rétrospective (ArianneWeb remonte à 1965 pour le CE)

**Accès technique** :
- **Dumps officiels** : https://opendata.justice-administrative.fr/ — archives ZIP contenant des fichiers XML pseudonymisés, un ZIP par juridiction et par période
- **API non documentée ArianneWeb** : POST `https://www.conseil-etat.fr/xsearch?type=json` avec body JSON structuré (query + filters). À confirmer par inspection DevTools.

**URL canonique publique** : `https://www.conseil-etat.fr/arianeweb/#/view-document/{id}` (format vérifié en inspection). Alternative ECLI : `https://www.conseil-etat.fr/fr/arianeweb/CE/decision/{date}/{num_req}`.

**Identifiant canonique à stocker** : numéro de requête + date de décision, OU ECLI si disponible dans le XML.

**Authentification** : aucune pour dumps. Pas connue pour l'API non documentée (probablement aucune).

**Quotas** : pas documentés pour l'API. Dumps = téléchargement one-shot.

**Fraîcheur** : les dumps sont mis à jour mensuellement selon la doc. ArianneWeb est quotidienne.

**Qualité** : pseudonymisation déjà effectuée par le CE (noms des parties masqués). Métadonnées : date, formation, numéro de requête, type de décision, texte, visa, dispositif, considerants.

**MCP existant** : aucun dédié (CE). À construire.

**Difficulté** : 2 — le parsing XML est standard, le volume est raisonnable.

**Valeur** : 5 — débloque l'intégralité du contentieux administratif français, énorme pour les avocats publicistes, fiscalistes, droit des étrangers.

---

### 3.2 🟠 HUDOC (CEDH)

**Organisme** : Conseil de l'Europe / Cour européenne des droits de l'homme

**Périmètre** : tous les arrêts, décisions, avis consultatifs, affaires communiquées. ~65 000 documents en français et anglais. Depuis 1959.

**Accès technique** :
- Pas d'API officielle documentée
- Endpoint découvert : GET `https://hudoc.echr.coe.int/app/query/results?query=...&contentsitename=ECHR&sort=Date%20Descending&start=0&length=100` retourne du JSON
- Le détail d'une décision : GET `https://hudoc.echr.coe.int/app/conversion/docx/html/body?library=ECHR&id={itemid}`

**URL canonique publique** : `https://hudoc.echr.coe.int/eng?i={itemid}` (ex. `i=001-139903`)

**Identifiant canonique** : `itemid` HUDOC (format `001-XXXXXX`)

**Authentification** : aucune

**Quotas** : non documentés. Expérience communautaire : pas de rate-limit agressif observé, mais prudence recommandée (~1 req/s).

**Licence** : usage libre pour recherche et information, citation de la source obligatoire.

**Fraîcheur** : quotidien (les arrêts sont publiés à J+0 sur HUDOC).

**Qualité** : métadonnées riches (importance level, respondent state, articles, conclusion, dates, thèmes), pas de pseudonymisation requise (juridiction internationale).

**MCP existant** : aucun connu.

**Difficulté** : 3 — reverse engineering du endpoint + parsing HTML/JSON hybride, mais faisable.

**Valeur** : 5 — sans CEDH, Datavocat manque une juridiction de premier plan pour le droit des étrangers, libertés fondamentales, pénal européen.

---

### 3.3 🟢 EUR-Lex / Cellar (CJUE + directives + règlements)

**Organisme** : Office des publications de l'Union européenne

**Périmètre** : tous les textes publiés au JOUE, jurisprudence CJUE (T, C, F), traités. >1M documents.

**Accès technique** (officiel, propre, documenté) :
- **SPARQL endpoint** : `https://publications.europa.eu/webapi/rdf/sparql` — requêtes SPARQL sur l'ontologie CDM
- **REST Cellar** : `https://publications.europa.eu/resource/{production-system}/{id}` où production-system ∈ {celex, oj, eli, …}
- **RSS/Atom feeds** : disponibles pour veille
- Documentation PDF : https://eur-lex.europa.eu/content/tools/webservices/DataExtractionUsingWebServices.pdf

**URL canonique publique** :
- Par CELEX : `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:{celex}` (ex. `CELEX:62019CJ0311`)
- Par ELI (textes normatifs) : `https://eur-lex.europa.eu/eli/reg/2016/679/oj`

**Identifiant canonique** : numéro CELEX ou URI ELI

**Authentification** : aucune (endpoints publics)

**Quotas** : raisonnables, pas de rate-limit public documenté. Pratique recommandée : <10 req/s.

**Licence** : Décision 2011/833/UE — réutilisation libre avec mention de la source.

**Fraîcheur** : quotidien (publication JOUE + métadonnées Cellar).

**Qualité** : excellente — métadonnées RDF structurées, multilinguisme 24 langues, typage juridique normalisé.

**MCP existant** : package R `eurlex` (michalovadek/eurlex) mais rien en MCP Node/Python à ma connaissance.

**Difficulté** : 2 — la stack officielle est solide, la courbe SPARQL demande un peu mais les exemples abondent.

**Valeur** : 4 — débloque le droit UE pour les contentieux commerciaux, concurrence, consommation, libertés.

---

### 3.4 🟢 CNIL sanctions

**Organisme** : Commission Nationale de l'Informatique et des Libertés

**Périmètre** : toutes les sanctions prononcées par la formation restreinte, ~300/an depuis 2014 + historique.

**Accès technique** :
- **Dataset data.gouv** : https://www.data.gouv.fr/datasets/sanctions-prononcees-par-la-cnil — métadonnées structurées (date, montant, type, entité sanctionnée) mais **pas le texte complet**
- **Page CNIL** : https://www.cnil.fr/fr/thematique/cnil/sanctions?page=N — scraping nécessaire pour le détail
- **Légifrance** : beaucoup de délibérations CNIL publiées — couvrables via l'API PISTE Légifrance existante

**URL canonique publique** :
- Sur Légifrance (le plus fiable) : `https://www.legifrance.gouv.fr/cnil/id/{CNILTEXTxxxxxxxxx}`
- Sur CNIL : `https://www.cnil.fr/fr/deliberation/{slug}`

**Identifiant canonique** : numéro de délibération (ex. `SAN-2023-016`)

**Authentification** : aucune

**Quotas** : scraping CNIL à bas débit (1 req/2s conseillé).

**Licence** : Etalab 2.0 (pour le dataset data.gouv) ; CNIL publications = usage libre.

**Fraîcheur** : la CNIL publie ses délibérations dans les 2-4 semaines suivant l'adoption.

**MCP existant** : aucun.

**Difficulté** : 2 — priorité sur l'API PISTE Légifrance (déjà accessible) qui couvre déjà beaucoup de délibérations.

**Valeur** : 3 — indispensable pour les avocats DPO / conformité RGPD.

---

### 3.5 🟠 AMF — Commission des sanctions

**Organisme** : Autorité des marchés financiers

**Périmètre** : décisions de la Commission des sanctions, ~50/an, remonte à 2004.

**Accès technique** :
- **Scraping** de https://www.amf-france.org/fr/sanctions-transactions/decisions-de-la-commission-des-sanctions
- Pas d'API
- Dataset data.gouv : aucun officiel trouvé

**URL canonique publique** : `https://www.amf-france.org/fr/sanctions-transactions/decisions-de-la-commission-des-sanctions/decision-{num-date}`

**Identifiant canonique** : référence AMF (ex. `SAN-2024-12`)

**Authentification** : aucune

**Quotas** : scraping prudent (1 req/2s).

**Licence** : CGU AMF — réutilisation avec mention de la source.

**Fraîcheur** : publication à J+0 sur le site AMF.

**Difficulté** : 3 — scraping + parsing de PDF (la plupart des décisions sont des PDF).

**Valeur** : 3 — utile pour avocats marchés financiers / M&A.

---

### 3.6 🟠 BODACC

**Organisme** : DILA · **Licence** : Etalab 2.0

**Périmètre** : toutes les annonces commerciales et civiles (créations/radiations de sociétés, procédures collectives, ventes de fonds, dépôts de comptes). Millions d'annonces.

**Accès technique** :
- **API open data officielle** : https://www.bodacc.fr/api/records/1.0/search/?dataset=annonces-commerciales...
- **Dataset data.gouv** : https://www.data.gouv.fr/datasets/bodacc-annonces-commerciales/

**URL canonique publique** : `https://www.bodacc.fr/annonce/detail-annonce/{periodique}/{parution}/{numero_annonce}`

**Identifiant canonique** : numéro d'annonce BODACC

**Authentification** : aucune

**Quotas** : API opendatasoft (~10 req/s), raisonnable.

**Fraîcheur** : quotidien.

**Difficulté** : 2 — API propre OpendataSoft, bien documentée.

**Valeur** : 3 — enrichit les décisions judiciaires par les informations entreprise (procédures collectives, faillites).

---

### 3.7 🟢 Légifrance via PISTE (codes + JO + QPC)

**Organisme** : DILA

**Périmètre déjà partiellement couvert via PISTE** :
- **Codes** (Code civil, Code du travail, CPC, etc.) — énorme volume, articles versionnés
- **JORF** (Journal officiel) — décrets, arrêtés
- **QPC** (Conseil constitutionnel)
- **Délibérations CNIL** — publiées sur Légifrance
- **Circulaires** — bulletins officiels ministériels

**Accès technique** :
- API Légifrance via PISTE — même clé PISTE que Judilibre (déjà configurée)
- Endpoints principaux :
  - `/consult/codeArticle` — article de code
  - `/consult/jorf` — journal officiel
  - `/consult/jurisdiction/CONSTIT` — Conseil constitutionnel
  - `/search` — recherche multi-fonds
- Doc officielle : https://piste.gouv.fr/ (authentification requise)

**URL canonique publique** :
- Code article : `https://www.legifrance.gouv.fr/codes/article_lc/{articleId}`
- JORF : `https://www.legifrance.gouv.fr/jorf/id/{jorftextId}`
- QPC : `https://www.conseil-constitutionnel.fr/decision/{year}/{num}QPC.htm`

**Identifiant canonique** : `LEGIARTI...`, `JORFTEXT...`, numéro QPC.

**Authentification** : PISTE (déjà configurée)

**Difficulté** : 1 — la clé et le client existent, il suffit d'ajouter les endpoints.

**Valeur** : 4 — permet les citations de codes et de Conseil constitutionnel, qui enrichissent toute analyse.

---

### 3.8 🟢 MCP `jmtanguy/droit-francais-mcp` + dumps `antoinejeannot/jurisprudence`

**Ce qui existe déjà côté communauté, exploitable** :

1. **[jmtanguy/droit-francais-mcp](https://github.com/jmtanguy/droit-francais-mcp)** — serveur MCP Python qui wrappe Légifrance + Judilibre via PISTE. Peut servir de référence pour notre propre client ou être utilisé directement si on passe à une archi MCP.

2. **[antoinejeannot/jurisprudence](https://github.com/antoinejeannot/jurisprudence)** — GitHub Actions qui publie toutes les 72h un dump structuré des décisions Cass./CA via Judilibre. Format : Parquet + JSON. Facile à ingérer en base, permet de se passer de l'appel PISTE en temps réel pour l'historique.

3. **[datagouv/datagouv-mcp](https://github.com/datagouv/datagouv-mcp)** — MCP officiel data.gouv.fr, MIT, sans clé API. À brancher directement via le protocol MCP côté Claude.

4. **[eliottgodet/mcp-server-legifrance](https://github.com/eliottgodet/mcp-server-legifrance)** — autre MCP Légifrance, à comparer.

**Stratégie** : utiliser `antoinejeannot/jurisprudence` comme **source de hydratation initiale** de notre base `decisions`, puis patcher en incrémental via PISTE. Ça nous donne un corpus de base exhaustif sans faire tomber les quotas PISTE.

---

## 4. Priorisation — 3 buckets

### 🟢 Quick wins (cette semaine / 10 jours)

Valeur élevée + difficulté faible + permalien public garanti.

1. **Légifrance — codes + JORF + QPC + CNIL** via la clé PISTE existante. Extension du client Judilibre existant. **ROI immédiat, 1-2 jours.**
2. **EUR-Lex Cellar** (REST + SPARQL). Client Node propre, métadonnées RDF. **3-4 jours.**
3. **Conseil d'État via dumps opendata.justice-administrative.fr** — télécharger les ZIP quotidiens, parser XML, indexer en base. **3-5 jours.**
4. **CNIL sanctions** via data.gouv dataset + fallback Légifrance pour le texte. **1 jour.**
5. **Dumps `antoinejeannot/jurisprudence`** — ingestion initiale du corpus Cass./CA (un shot, pour constituer la base de départ). **1-2 jours.**

### 🟠 Stratégiques (1-3 mois)

Valeur élevée mais complexité significative (reverse engineering, ingestion massive).

6. **HUDOC (CEDH)** — client spécifique avec endpoint non officiel + parsing HTML/JSON. Tests de robustesse.
7. **BODACC** — API open data officielle, facile techniquement mais volume à gérer (partitionnement, déduplication).
8. **AMF Commission des sanctions** — scraping + parsing PDF.

### 🟡 Nice-to-have (backlog)

Volume faible ou complexité disproportionnée.

9. **ADLC** (Autorité de la concurrence) — volume modeste, scraping.
10. **ARCOM** — ~30 décisions/an, valeur niche.
11. **HATVP** — valeur niche pour avocats pénalistes / politique.
12. **INPI RNE** — utile pour enrichissement entreprise, pas une source de décisions.

### ❌ Écartés

- **Tribunaux de commerce** (via Infogreffe) — payant, CGU restrictives, pas d'opendata équivalent à Judilibre.
- **Bases commerciales** (Dalloz, Lexbase, Doctrine, Lamy) — hors scope (payant).
- **Tribunaux correctionnels / cours d'assises** — open data pas encore ouvert (prévu post-2026 selon le calendrier de l'article 33 de la loi Belloubet).

---

## 5. Plan d'action détaillé — sources prioritaires

### 5.1 Schéma Supabase commun (nouvelle table `decisions`)

```sql
-- Migration 00017 (nouvelle)
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  source TEXT NOT NULL,               -- 'judilibre' | 'conseil_etat' | 'hudoc' | 'eurlex' | 'cnil' | 'amf' | 'bodacc' | 'legifrance_code' | 'legifrance_jorf'
  source_id TEXT NOT NULL,            -- id natif dans la source (itemid HUDOC, celex, LEGIARTI..., num requête CE)
  ecli TEXT,                          -- European Case Law Identifier si disponible
  pourvoi TEXT,                       -- n° pourvoi/requête (nullable selon source)

  -- Permalien OBLIGATOIRE (clef du produit)
  source_url TEXT NOT NULL,
  source_url_verified_at TIMESTAMPTZ, -- dernière vérif HTTP 200

  -- Métadonnées juridiques
  juridiction TEXT,                   -- 'Cass. soc.', 'CE', 'CEDH', 'CJUE', 'CNIL', ...
  chambre TEXT,
  formation TEXT,
  decision_date DATE,
  solution TEXT,                      -- 'cassation', 'rejet', 'confirmation', 'annulation'...
  publication TEXT[],                 -- 'Bull.', 'Rec.'
  themes TEXT[],

  -- Texte
  title TEXT,
  summary TEXT,
  full_text TEXT,
  visa TEXT[],
  dispositif TEXT,

  -- Indexation
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(full_text, '')), 'C')
  ) STORED,
  embedding VECTOR(1536),             -- Claude / OpenAI embeddings (à choisir)

  -- Traçabilité ingestion
  ingested_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  raw JSONB,                          -- payload brut de la source pour audit

  UNIQUE (source, source_id)
);

CREATE INDEX idx_decisions_ecli ON decisions(ecli) WHERE ecli IS NOT NULL;
CREATE INDEX idx_decisions_pourvoi ON decisions(pourvoi) WHERE pourvoi IS NOT NULL;
CREATE INDEX idx_decisions_source_date ON decisions(source, decision_date DESC);
CREATE INDEX idx_decisions_search ON decisions USING GIN(search_vector);
CREATE INDEX idx_decisions_embedding ON decisions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

-- Table des logs d'ingestion
CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'success', 'partial', 'error')),
  decisions_added INTEGER DEFAULT 0,
  decisions_updated INTEGER DEFAULT 0,
  errors JSONB
);
```

### 5.2 Quick win #1 — Légifrance étendu

**Fichiers à créer** :
- `src/lib/legifrance/client.ts` — extension de la clé PISTE existante
- `src/app/api/legifrance/article/route.ts` — endpoint pour citer un article de code
- `src/app/api/legifrance/jorf/route.ts` — endpoint JORF

**Endpoints à câbler** :
```
POST https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/codeArticle
    body: { id: "LEGIARTI000006900846" }

POST https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/jorf
    body: { textCid: "JORFTEXT000046617711" }

POST https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search
    body: { recherche: { champs: [...], fond: "CODE_DATE" } }
```

**Construction URL canonique** :
```ts
function legifranceCodeUrl(articleId: string): string {
  return `https://www.legifrance.gouv.fr/codes/article_lc/${articleId}`;
}
function legifranceJorfUrl(textId: string): string {
  return `https://www.legifrance.gouv.fr/jorf/id/${textId}`;
}
```

**Validation permalien** : `HEAD` + status 200 à l'ingestion ou en temps réel.

**Intégration dans le flow actuel** : enrichir `analyze-prompt.ts` pour que Claude puisse citer des articles de code avec leur ID `LEGIARTI...`, et côté parser ajouter un regex qui détecte `LEGIARTI\d+` et construit l'URL.

---

### 5.3 Quick win #2 — Conseil d'État (ingestion dumps)

**Architecture** :
1. Script Node (ou Python) qui tourne en cron quotidien sur Vercel Cron ou sur un worker séparé
2. Téléchargement des ZIP depuis `opendata.justice-administrative.fr`
3. Parse XML (jsdom ou fast-xml-parser)
4. Upsert dans `decisions` avec `source='conseil_etat'`

**Fichier** : `scripts/ingest-conseil-etat.mjs`

```js
// Pseudo-code
const LIST_URL = "https://opendata.justice-administrative.fr/content/donnees-ouvertes.php";
// 1. Scraper la liste des ZIP disponibles (liens <a href="...zip">)
// 2. Pour chaque nouveau ZIP : télécharger, unzip, parser XML
// 3. Pour chaque décision XML :
//    - Extraire : id, numero_requete, date, formation, texte, dispositif
//    - Construire source_url = `https://www.conseil-etat.fr/arianeweb/#/view-document/${id}`
//    - HEAD check (optionnel)
//    - UPSERT dans decisions
```

**Déduplication** : `UNIQUE (source, source_id)` fait le travail.

**Cadence** : quotidien vers 6h du matin (les dumps sont rafraîchis la nuit).

**Risques** :
- Le format ZIP/XML peut évoluer → versionner le parser
- Volume initial important (2M décisions si on prend tout) — commencer par CE seul (270k) puis étendre aux CAA/TA

---

### 5.4 Quick win #3 — EUR-Lex Cellar

**Fichier** : `src/lib/eurlex/client.ts`

**Stratégie** :
- Ingestion initiale via SPARQL pour récupérer les métadonnées de toute la jurisprudence CJUE (filtrer sur `work-type = judgment`)
- REST Cellar pour récupérer le texte intégral en français (`language = fra`)
- Construire `source_url = https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${celex}`

**Exemple SPARQL** (à adapter) :
```sparql
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?celex ?date ?title WHERE {
  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/JUDG> ;
        cdm:work_date_document ?date ;
        cdm:resource_legal_id_celex ?celex ;
        cdm:work_title ?title .
  FILTER (?date >= "2020-01-01"^^xsd:date)
} LIMIT 1000
```

**Cadence** : hebdomadaire (la jurisprudence CJUE n'est pas quotidienne intense).

---

### 5.5 Stratégique #1 — HUDOC

**Fichier** : `src/lib/hudoc/client.ts`

**Endpoint non officiel** :
```
GET https://hudoc.echr.coe.int/app/query/results
    ?query=*&contentsitename=ECHR
    &sort=Date Descending
    &start=0&length=100
```

Retour : JSON avec liste d'items, chacun ayant `itemid`, `docname`, `languageisocode`, `originatingbody`, etc.

**Récupération du texte** :
```
GET https://hudoc.echr.coe.int/app/conversion/docx/html/body
    ?library=ECHR&id={itemid}
```

Retour : HTML formaté → à parser pour extraire le texte pertinent.

**Permalien** : `https://hudoc.echr.coe.int/eng?i={itemid}` ou `fre?i={itemid}`.

**Risque principal** : le endpoint est non documenté. Si la CEDH restructure son frontend, le client casse. → mettre en place un monitoring (HEAD check du permalien, alerting).

**Pagination** : `start` + `length` (max 500). Parcours initial ~130 pages pour 65k items.

---

### 5.6 Stratégique #2 — BODACC

**Fichier** : `src/lib/bodacc/client.ts`

**Endpoint** :
```
GET https://bodacc-datadila.opendatasoft.com/api/records/1.0/search/
    ?dataset=annonces-commerciales
    &rows=100
    &sort=dateparution
    &q=procedurecollective:*
```

**Cadence** : quotidien pour les nouvelles parutions, filtré sur les types utiles (`procedurecollective`, `ventesdecessions`, `depotdescomptes`).

**Jointure avec `decisions` existantes** : matching SIREN/SIRET pour enrichir les décisions citant une entreprise sous procédure collective.

---

## 6. Questions à toi (actions à valider / fichiers à fournir)

### Décisions business à prendre

- [ ] **Architecture** : on part sur **hybride live+ingestion** comme recommandé, ou tu préfères rester 100% stateless ?
- [ ] **Priorité #1** parmi les quick wins : Légifrance étendu, Conseil d'État, ou EUR-Lex ? Je propose **Conseil d'État** en premier (plus gros impact user).
- [ ] **Budget temps** disponible pour cette extension ? (3 jours, 2 semaines, 1 mois ?) — ça conditionne le phasage.
- [ ] **Volume initial** pour le dump `antoinejeannot/jurisprudence` : tout (Cass. + CA) ou juste Cass. ? Tout = quelques GB.
- [ ] **Périmètre temporel** : on remonte jusqu'où (2000, 2010, 2015) pour l'historique ? Plus on remonte, plus le poids augmente, mais certains contentieux ont besoin de jurisprudence des années 80-90.

### Comptes à créer / clés à fournir

- [ ] **PISTE** déjà OK (clé `PISTE_KEY_ID` présente) — rien à faire.
- [ ] **data.europa.eu / EUR-Lex** : aucun compte requis, accès public.
- [ ] **ECHR HUDOC** : aucun compte requis.
- [ ] **opendata.justice-administrative.fr** : aucun compte.
- [ ] **BODACC** : aucun compte.
- [ ] **API Entreprise** (si on branche INPI RNE un jour) : nécessite un compte pro avec justification d'usage. → à reporter.

### Infrastructure Supabase

- [ ] Activer l'extension **pgvector** sur le projet Supabase prod (Dashboard > Database > Extensions) si ce n'est pas déjà fait.
- [ ] Décider du modèle d'embeddings : `text-embedding-3-small` (OpenAI, 1536 dims) vs `voyage-2` vs embeddings Anthropic. Ça impacte la dim du `VECTOR(1536)` dans le schéma.
- [ ] Valider que le plan Supabase actuel supporte le volume attendu (270k + 2M à terme = quelques Go, plan Pro requis).

### Fichiers / code à me fournir

- [ ] Accès au repo n8n si tu veux que j'écrive les workflows d'ingestion en n8n plutôt qu'en scripts Node standalone.
- [ ] Tes scripts d'ingestion actuels s'il y en a (pas trouvés dans le repo Datavocat current, mais peut-être dans un autre repo ?).

### Validation légale

- [ ] Rappeler **l'article 33 loi n° 2019-222** (anonymisation des magistrats) pour tous les nouveaux fonds. Le CE a déjà fait la pseudonymisation sur ses dumps, OK. Pour HUDOC et EUR-Lex c'est une juridiction internationale, non concerné. Pour CNIL/AMF, prudence sur les noms des rapporteurs.
- [ ] Vérifier les CGU data.gouv et opendatasoft pour BODACC (Etalab 2.0 → OK).

---

## 7. Checklist actionnable pour démarrer l'ingestion n°1

Dès que tu as tranché la question business #1 (priorité) :

1. [ ] Créer la migration `00017_create_decisions_ingestion.sql` avec le schéma ci-dessus (§5.1)
2. [ ] Activer pgvector dans Supabase
3. [ ] Ajouter le service role vers la RLS policy pour les ingestions
4. [ ] Créer le premier client dans `src/lib/{source}/client.ts` (Conseil d'État, Légifrance ou EUR-Lex selon choix)
5. [ ] Créer le script d'ingestion dans `scripts/ingest-{source}.mjs`
6. [ ] Test local : ingestion d'un sous-ensemble (10-100 décisions), vérif permaliens HTTP 200
7. [ ] Déployer le script comme cron (Vercel Cron ou worker séparé)
8. [ ] Brancher les nouvelles décisions dans `analyze-prompt.ts` pour que Claude les utilise
9. [ ] Ajouter les URL canoniques dans le parser (`parse-analysis.ts`) pour affichage cliquable

---

## Sources

- [Open Data Conseil d'État](https://opendata.justice-administrative.fr/)
- [ArianneWeb — base du Conseil d'État](https://www.conseil-etat.fr/decisions-de-justice/donnees-ouvertes-open-data)
- [HUDOC CEDH](https://hudoc.echr.coe.int/eng)
- [EUR-Lex — Reuse content](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html)
- [EUR-Lex Cellar technical info](https://op.europa.eu/en/web/cellar/cellar-data)
- [CNIL — Sanctions dataset data.gouv](https://www.data.gouv.fr/datasets/sanctions-prononcees-par-la-cnil)
- [CNIL — Toutes les sanctions](https://www.cnil.fr/fr/thematique/cnil/sanctions)
- [AMF — Décisions Commission des sanctions](https://www.amf-france.org/en/sanction-transaction/Decisions-de-la-commission-des-sanctions)
- [ARCOM — Décisions](https://www.arcom.fr/se-documenter/espace-juridique/decisions)
- [BODACC — Données ouvertes et API](https://www.bodacc.fr/pages/donnees-ouvertes-et-api/)
- [INPI — Data INPI](https://data.inpi.fr/)
- [API Entreprise — INPI RNE](https://entreprise.api.gouv.fr/catalogue/inpi/rne/actes_bilans)
- [MCP — jmtanguy/droit-francais-mcp](https://github.com/jmtanguy/droit-francais-mcp)
- [MCP — datagouv/datagouv-mcp](https://github.com/datagouv/datagouv-mcp)
- [Dumps — antoinejeannot/jurisprudence](https://github.com/antoinejeannot/jurisprudence)
- [MCP — eliottgodet/mcp-server-legifrance](https://lobehub.com/mcp/eliottgodet-mcp-server-legifrance)
- [Analyse open data jurisprudence — Fondamentaux.org](https://fondamentaux.org/2021/open-data-des-decisions-de-justice-et-api-des-cours-francaises-et-europeennes/)

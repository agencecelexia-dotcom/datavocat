# Guide — Connecter de nouvelles sources de données

État au 28 juillet 2026.

---

## Sources actuellement branchées et fonctionnelles

| Source | Couverture | État |
|---|---|---|
| **Judilibre** (via PISTE) | Cour de cassation (~480 000) + Cours d'appel (~82 000) + **Tribunaux judiciaires** + **Tribunaux de commerce** | ✅ Récolte 4 vagues parallèles + multi-pages + filtre Haiku 30-100 |
| **Légifrance CETAT** (via PISTE) | Conseil d'État + CAA + TA (~270 000) | ✅ Vague parallèle si matière administrative |
| **Légifrance JURI** (via PISTE) | Jurisprudence judiciaire historique (< 1990, inédits) | ✅ Vague parallèle systématique hors admin |
| **Justicelibre** (MCP public) | **CEDH (~76 k) + CJUE (~44 k) + CNIL (~8 k)** + admin en secours | ✅ Vague parallèle conditionnelle, sans authentification |
| data.gouv.fr | Métadonnées de datasets — pas d'apport jurimétrique | ⚠️ Branché mais désactivé du loader (placebo) |

---

## Justicelibre — détail de l'intégration

**Endpoint** : `https://justicelibre.org/mcp` (Streamable HTTP, sans clé).
**Code** : `src/lib/justicelibre/client.ts`, branché dans `searchJudilibreForAnalysis`.
**Licence** : MIT (code) + Licence Ouverte 2.0 Etalab (données).

### Routage conditionnel

On n'interroge une source que si la requête la justifie — chaque source coûte
de la latence et du budget de contexte :

| Source | Déclencheur |
|---|---|
| `search_cedh` | CEDH, convention européenne, procès équitable, garde à vue, libertés fondamentales… |
| `search_cjue` | CJUE, droit de l'Union, directive, règlement UE, question préjudicielle… |
| `search_cnil` | CNIL, RGPD, données personnelles, DPO, consentement… |
| `search_admin` | matière administrative **et** Légifrance indisponible (filet de secours) |

### Garanties

- **Jamais bloquant** : toute erreur réseau, schéma inattendu ou timeout (12 s)
  dégrade silencieusement vers un tableau vide. L'analyse continue avec le
  corpus Judilibre seul. Vérifié : serveur injoignable → échec en ~50 ms.
- **Stats non corrompues** : CEDH, CJUE et CNIL sont exclues de l'échantillon
  jurimétrique (`isStatisticalDecision` dans `stats.ts`). Elles nourrissent le
  prompt comme contexte normatif mais **n'entrent ni dans le taux de succès ni
  dans la hiérarchie 1er degré / appel / cassation**. Sans cette exclusion,
  elles auraient été comptées en « premier degré » et fausseraient la métrique
  phare du produit.
- **Liens sources corrects** : les itemid HUDOC (`001-XXXXXX`), les CELEX et les
  ECLI européens pointent vers hudoc.echr.coe.int / eur-lex.europa.eu, pas vers
  Légifrance qui ne les indexe pas (`buildSourceUrl` dans `parse-analysis.ts`).
- **Pas de référence inventée** : une ligne sans identifiant exploitable est
  écartée ; le sens de la décision (`solution`) est laissé vide plutôt que
  deviné, Justicelibre ne le qualifiant pas.

### Vérifier / désactiver

```bash
node scripts/test-justicelibre.mjs   # diagnostic complet des 4 sources
```

```
JUSTICELIBRE_ENABLED=false   # coupe la source proprement
JUSTICELIBRE_URL=...         # pointe vers une instance auto-hébergée
```

⚠️ **Serveur communautaire** : pas de SLA. C'est précisément pourquoi
l'intégration est non-bloquante. Si la disponibilité devient un problème,
le projet est auto-hébergeable (`python3 server.py http`, MIT).

---

Pour étendre davantage, voir les options ci-dessous **classées par rentabilité
jurimétrique**.

---

## Option 1 — Légifrance (HAUTE priorité, codes + lois + JORF)

### Apport
- Texte intégral des articles cités dans les arrêts (« Art. L1232-1 C. trav. » → contenu réel de l'article)
- Lois récentes (notamment réformes en cours)
- JORF (publications officielles)
- QPC / décisions constitutionnelles

### Ce que tu dois faire (15 min)

1. Va sur https://piste.gouv.fr et connecte-toi avec ton compte qui a déjà la clé Judilibre.
2. **Mon profil → Mes applications** : sélectionne l'application qui a `PISTE_KEY_ID`.
3. **Onglet "APIs"** : clique sur **"Ajouter une API"** → cherche **"Légifrance Beta"** (ou « Légifrance ») → demande l'accès.
4. Validation manuelle par l'équipe PISTE en général sous 24h.
5. Une fois validé, l'application **doit aussi avoir un Client OAuth** (différent du KeyId). Va dans **Mon profil → OAuth Apps** → crée une app si pas déjà fait → tu obtiens `Client ID` et `Client Secret`.
6. Ajoute dans `.env.local` :
   ```
   PISTE_OAUTH_CLIENT_ID=...
   PISTE_OAUTH_CLIENT_SECRET=...
   ```
7. Dis-moi « **Légifrance activé** » → je code l'intégration en ~2 h.

### Ce que ça donnera côté UI
- Quand le rapport cite un article, hover/click révèle le texte intégral à jour
- Le tableau de preuve gagne une colonne « Articles applicables » remplie automatiquement
- Le prompt voit les vrais textes au lieu de se baser sur ses connaissances

---

## Option 2 — ArianneWeb / contentieux administratif → ✅ LARGEMENT COUVERT

Le contentieux administratif est aujourd'hui servi par **deux** canaux :
Légifrance CETAT (branché, ~270 k) et Justicelibre `search_admin` (filet de
secours quand PISTE est indisponible).

L'estimation « 3-5 jours + 50 €/mois de stockage » de la version précédente de
ce guide est **caduque** : elle supposait de télécharger et indexer les dumps
XML quotidiens. Deux raccourcis existent désormais :

1. Justicelibre expose déjà l'administratif en MCP — **coût zéro, déjà branché**.
2. `opendata.justice-administrative.fr` expose une **API Elasticsearch publique**
   (`/recherche/api/elastic/decisions`), sans clé — pas de dump à indexer.

À ne rouvrir que si tu veux la maîtrise totale de l'index (recherche vectorielle
maison sur le fonds administratif).

---

## Option 3 — EUR-Lex / CJUE → ✅ COUVERT par Justicelibre

~44 000 arrêts CJUE via `search_cjue`, sans avoir à écrire de client SPARQL.

Reste ouvert uniquement si tu veux les **textes normatifs UE** eux-mêmes
(directives, règlements) et pas seulement la jurisprudence : là il faudrait un
client CELLAR (~1 jour).

---

## ~~Option 4 — HUDOC / CEDH~~ → ✅ COUVERT par Justicelibre

~76 000 arrêts CEDH accessibles via `search_cedh`. Plus besoin de scraper
HUDOC : Justicelibre a déjà fait ce travail et l'expose en MCP.

---

## ~~Option 5 — CNIL~~ → ✅ COUVERT par Justicelibre

~8 000 délibérations CNIL via `search_cnil` (bien plus que les ~1 500
initialement estimées).

---

## Option 6 — BODACC (FAIBLE priorité)

### Apport
- Annonces commerciales (créations, redressements, faillites, dépôts de comptes)
- Utile pour CONTEXTUALISER (« cette société a été en redressement en 2023 ») mais pas pour la jurisprudence elle-même

### État
API publique fonctionnelle (testée), pas de clé requise.
Mais peu d'apport jurimétrique → **pas brancher sauf demande**.

---

## MCP servers juridiques publics

État au 28 juillet 2026 : toujours **aucun MCP server juridique français
officiel**, mais l'écosystème communautaire a mûri.

- ✅ **`Dahliyaal/justicelibre`** — **branché** (voir plus haut). ~3,3 M décisions
  + 1,5 M articles, sans authentification, MIT. Seul à couvrir CEDH, CJUE et CNIL.
- `jmtanguy/droit-francais-mcp` — wrapper Légifrance + Judilibre via PISTE.
  Doublon avec notre intégration directe.
- `eliottgodet/mcp-server-legifrance`, `pylegifrance` — Légifrance seul, doublon.

**Décision** : Judilibre et Légifrance restent intégrés en direct (données
officielles, contrôle total). Justicelibre vient en complément pour les
juridictions qu'aucune API PISTE n'expose.

Si tu veux que je crée notre propre **MCP Datavocat** (qui exposerait Judilibre + nos sources internes pour d'autres outils Anthropic ou ChatGPT), c'est faisable mais c'est un projet à part.

---

## Ordre d'attaque recommandé

1. **Valider Justicelibre en conditions réelles** : `node scripts/test-justicelibre.mjs`.
   L'intégration est écrite et testée contre un serveur simulé conforme au
   schéma documenté, mais **jamais contre l'endpoint de production** (bloqué
   depuis l'environnement de développement). C'est la seule inconnue restante.
2. **Vérifier que Légifrance est bien actif en prod** (`PISTE_CLIENT_ID` +
   `PISTE_CLIENT_SECRET` sur Vercel) : `node scripts/test-legifrance.mjs`.
   Sans ces variables, tout l'administratif repose sur le seul filet Justicelibre.
3. **Passer `PISTE_SANDBOX=false`** pour la production.
4. Sources restantes (BODACC, textes normatifs UE) : seulement sur cas concret.

---

## Ce que JE peux faire seul, sans intervention de ta part

- ✅ Optimiser la stratégie de recherche Judilibre (chambres, dates, opérateurs).
- ✅ Améliorer le filtre Haiku (prompts, scoring).
- ✅ Brancher toute source publique sans authentification (comme Justicelibre).
- ❌ Activer Légifrance / PISTE — nécessite tes clés.
- ❌ Tester un endpoint externe depuis l'environnement de dev — le proxy sortant
  bloque les domaines non autorisés. D'où les scripts `scripts/test-*.mjs`,
  à lancer depuis ta machine.

Dis-moi par où tu veux commencer.

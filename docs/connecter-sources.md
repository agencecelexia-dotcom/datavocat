# Guide — Connecter de nouvelles sources de données

État au 25 avril 2026.

---

## Sources actuellement branchées et fonctionnelles

| Source | Couverture | État |
|---|---|---|
| **Judilibre** (via PISTE) | Cour de cassation (~480 000) + Cours d'appel (~82 000) + **Tribunaux judiciaires** (~plusieurs milliers) + **Tribunaux de commerce** (~centaines) | ✅ Récolte 4 vagues parallèles + multi-pages + filtre Haiku 30-100 |
| data.gouv.fr | Métadonnées de datasets — pas d'apport jurimétrique | ⚠️ Branché mais désactivé du loader (placebo) |

C'est aujourd'hui la seule source vraiment exploitée. Pour étendre, voir les options ci-dessous **classées par rentabilité jurimétrique**.

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

## Option 2 — ArianneWeb (HAUTE priorité, contentieux administratif)

### Apport
- Conseil d'État (270 000+ décisions)
- Cours administratives d'appel (CAA)
- Tribunaux administratifs (TA)
- **Débloque tout le contentieux fiscal, urbanisme, fonction publique, marchés publics, étrangers**

### Ce que tu dois faire (gratuit, infrastructure à monter)

Ce n'est PAS une simple clé API : ArianneWeb diffuse des **dumps quotidiens en XML** qu'il faut télécharger, parser, indexer.

1. Pas d'inscription nécessaire — la source est ouverte : https://opendata.justice-administrative.fr/
2. Dis-moi « **branche ArianneWeb** » → je propose un chantier dédié :
   - Job CRON quotidien qui télécharge le dump (~50-100 Mo/jour, ~30 Go cumulés)
   - Parsing XML → table Supabase dédiée `decisions_admin`
   - Index pgvector pour recherche sémantique
   - Intégration dans la pipeline `searchJudilibreForAnalysis` comme une 2e source en parallèle
3. Effort estimé : **3-5 jours de dev + ~50 €/mois en stockage Supabase**

---

## Option 3 — EUR-Lex / CJUE (MOYENNE priorité, droit UE)

### Apport
- Arrêts de la Cour de justice de l'UE
- Directives, règlements UE
- Pertinent pour : RGPD, concurrence, marchés financiers, propriété intellectuelle, directives sociales

### Ce que tu dois faire
Aucune inscription. Mais l'API officielle CELLAR est complexe (SPARQL).

Dis-moi « **EUR-Lex en niche RGPD/concurrence** » → je code un client minimal qui se déclenche **uniquement** quand la query mentionne ces matières (sinon ça pollue inutilement le prompt).

Effort : **~1 jour de dev**.

---

## Option 4 — HUDOC / CEDH (NICHE, droits fondamentaux)

### Apport
- 65 000 arrêts de la Cour européenne des droits de l'homme
- Pertinent pour : droit des étrangers, garde à vue, procès équitable, vie privée

### Ce que tu dois faire
Pas d'API officielle. Endpoint non documenté (fragile, peut casser).

Dis-moi « **HUDOC en niche libertés** » → je code un scraper respectueux qui se déclenche sur les mots-clés CEDH, droits fondamentaux, garde à vue, etc.

Effort : **~2 jours**, fragile (peut casser si HUDOC change leur frontend).

---

## Option 5 — CNIL (NICHE, RGPD)

### Apport
- ~1500 délibérations CNIL (sanctions, mises en demeure)
- Pertinent uniquement si l'avocat fait du RGPD/données personnelles

### Ce que tu dois faire
Pas d'API. Soit scraping de cnil.fr/fr/sanctions, soit data.gouv.fr (jeu de données partiel).

Dis-moi « **CNIL pour le RGPD** » → je code en ~1 jour.

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

État au 25 avril 2026 : **aucun MCP server juridique français officiel n'existe**.

Alternatives communautaires repérées (à utiliser à tes risques) :
- `jmtanguy/droit-francais-mcp` (GitHub) — wrapper Légifrance + Judilibre via PISTE. Doublon avec ce qu'on fait déjà.
- `eliottgodet/mcp-server-legifrance` — Légifrance seul. Pourrait servir si tu actives Légifrance via OAuth.

**Décision** : pas de MCP tiers pour l'instant, on intègre les APIs directement (plus stable).

Si tu veux que je crée notre propre **MCP Datavocat** (qui exposerait Judilibre + nos sources internes pour d'autres outils Anthropic ou ChatGPT), c'est faisable mais c'est un projet à part.

---

## Ordre d'attaque recommandé

1. **D'abord vérifier que la pipeline actuelle (TJ + TCOM ajoutés)** donne ce que tu attends sur des sujets variés. C'est déjà un saut majeur en couverture.
2. **Activer Légifrance** (15 min de ta part + 2h de code chez moi) — gain énorme sur la précision juridique.
3. **Réfléchir à ArianneWeb** si ta cible inclut des avocats publicistes (fiscalistes, urbanisme, fonction publique). Sinon skip.
4. EUR-Lex / HUDOC / CNIL : seulement si tu identifies des cas concrets où ça manque.

---

## Ce que JE peux faire seul, sans intervention de ta part

- ✅ Optimiser encore la stratégie de recherche Judilibre (chambres, dates, opérateurs).
- ✅ Améliorer le filtre Haiku (prompts, scoring).
- ✅ Préparer le code d'intégration de toute nouvelle source (mais le branchement nécessite tes clés/validations).
- ❌ Activer Légifrance, ArianneWeb, etc. — nécessite tes actions ci-dessus.

Dis-moi par où tu veux commencer.

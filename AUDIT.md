# Audit Datavocat — état des lieux complet

> ## ✅ Corrections appliquées le 13 août 2026
>
> Tous les constats de ce rapport ont été traités sur la branche
> `audit/corrections-completes` (5 commits, paliers 0 à 3).
> **Ce document conserve l'état AVANT correction** — il documente ce qui a été
> trouvé et pourquoi c'était un problème. Voir la section « Suivi des
> corrections » en fin de document pour l'état actuel de chaque point.
>
> Vérifications : typecheck ✓ · 22 tests ✓ · build de production ✓
>
> **Deux actions restent à ta main** : appliquer la migration `00019` en base
> (elle ferme la faille RLS), et renseigner les variables `NEXT_PUBLIC_LEGAL_*`
> pour les mentions légales.

> Audit réalisé le 13 août 2026 sur la branche `main` (commit `b492331`).
> Méthode : 3 agents d'exploration en parallèle (backend/IA, frontend/UX, sécurité/BDD/infra),
> puis vérification directe par lecture de code de tous les points Critique et Élevé.
> **Aucun point critique de ce document n'est rapporté sur la seule foi d'un agent** — tous
> ont été reproduits en lisant le fichier concerné.

Périmètre : 113 fichiers TS/TSX, ~25 000 lignes, 18 migrations SQL, 144 commits.

---

## 0. Synthèse

Datavocat est un produit **sérieusement construit sur son cœur métier**. Le prompt système
anti-hallucination, `verify.ts`, la conformité déontologique (art. 33, monopole du conseil)
et la discipline TypeScript sont nettement au-dessus de la moyenne. Rien de ce qui suit ne
remet en cause cette qualité de fond.

Trois familles de problèmes, distinctes dans leur nature :

**1. Exposition (C1-C3)** — trois failles ouvrent aujourd'hui les analyses couvertes par le
secret professionnel, la facturation Anthropic et le contrôle d'accès. Correction courte
(une demi-journée), priorité absolue.

**2. Véracité des chiffres (C4-C6, E7-E8)** — c'est le constat le plus important de cet audit,
et le plus inattendu vu la rigueur affichée ailleurs. L'architecture anti-hallucination est
excellente **côté serveur**, mais :
- elle est **débranchée côté affichage** (le filtre corpus de `extractSources` ne s'exécute jamais) ;
- elle est **trahie par `patchAnnouncedCount`**, qui réécrit les effectifs sans recalculer les pourcentages ;
- plusieurs chiffres publiés comme jurimétriques sont en réalité des **artefacts de parsing** :
  le « taux de condamnation » art. 700 est un taux de détection textuelle, les « taux par argument »
  reposent sur un classement documentaire sans lien causal avec les moyens, les « variations
  régionales » sont des variations par chambre mal étiquetées ;
- des **données sont fabriquées** en amont : chambre « soc » par défaut, dates au 1er janvier ;
- et « 562 487 décisions » est un littéral hardcodé affiché comme preuve.

Autrement dit : le produit tient sa promesse d'honnêteté dans son architecture serveur et dans
les avertissements du dashboard (qui sont remarquables, cf. §5), mais la trahit sur plusieurs
chiffres précis que l'avocat lit comme des faits. **Pour un produit dont c'est la promesse
centrale, ce risque passe devant les failles d'accès en importance stratégique** — même si les
failles se corrigent en premier parce qu'elles sont plus urgentes et plus rapides.

**3. Absence de filet (M4)** — l'asymétrie centrale : beaucoup de rigueur sur le typage et le
prompt, **zéro test et zéro CI** sur un moteur statistique de 25 000 lignes. C'est ce qui permet
à une défaillance muette comme E1 (rerank cassé) de vivre indéfiniment.

### Tableau des constats

> La colonne « Vérifié » indique que le constat a été **reproduit par lecture de
> code** lors de l'audit — pas qu'il est corrigé. Pour l'état des corrections,
> voir le §8 en fin de document.

| # | Constat | Sévérité | Vérifié |
|---|---|---|:---:|
| **C1** | Policies RLS `USING (true)` sans clause `TO` → analyses lisibles par tout le monde | **Critique** | ✅ |
| **C2** | `/api/chat` et `/api/clarify` : proxys LLM non authentifiés | **Critique** | ✅ |
| **C3** | Auto-approbation : `approved` dans `user_metadata`, modifiable par le client | **Critique** | ✅ |
| **C4** | Le « taux de succès » ne mesure pas ce qu'il annonce | **Critique** (produit) | ✅ |
| **C5** | `patchAnnouncedCount` réécrit les effectifs sans recalculer les % → rapport livré avec des pourcentages faux | **Critique** | ✅ |
| **C6** | Données fabriquées : chambre « soc » inventée, date au 1er janvier, `solution` vide sur tout le fonds JURI | **Critique** (produit) | ✅ |
| **E1** | Rerank Haiku cassé en silence au-delà de ~300 décisions | **Élevé** | ✅ |
| **E7** | « 562 487 décisions » hardcodé, affiché 4× comme preuve | **Élevé** (produit) | ✅ |
| **E8** | Statistiques qui n'en sont pas : taux art. 700, taux par argument, variations « régionales » | **Élevé** (produit) | ✅ |
| **E2** | `/api/*` entièrement exclu du middleware — pas de contrôle `approved` | **Élevé** | ✅ |
| **E3** | `CRON_SECRET` optionnel : absent = route publique | **Élevé** | ✅ |
| **E4** | Aucun en-tête de sécurité, aucune CSP | **Élevé** | ✅ |
| **E5** | Aucune limite de débit sur les routes LLM | **Élevé** | ✅ |
| **E6** | Politique de confidentialité décrit un traitement supprimé (migration 00016) | **Élevé** (RGPD) | ✅ |
| **M1** | `maxDuration` incohérent ; `/api/rapport` sans timeout déclaré | **Moyen** | ✅ |
| **M2** | `src/types/database.ts` désynchronisé → casts `as unknown` | **Moyen** | ✅ |
| **M3** | Stats calculées serveur → récitées en markdown → re-parsées par regex | **Moyen** | ✅ |
| **M4** | Aucun test, aucune CI, aucune observabilité | **Moyen** | ✅ |
| **M5** | Mentions légales avec placeholders non remplis | **Moyen** (LCEN) | ✅ |
| **M6** | Rétention annoncée mais non implémentée | **Moyen** (RGPD) | ✅ |
| **M7** | `scripts/setup-database.sql` = schéma mort, dangereux si rejoué | **Moyen** | ✅ |
| **F1** | Mot de passe min. 6 car., actuel jamais vérifié | **Faible** | ✅ |
| **F2** | Fichiers monolithes (slides 2217 l., page 1451 l.) | **Faible** | ✅ |
| **F3** | README = template `create-next-app` jamais modifié | **Faible** | ✅ |
| **F4** | Email personnel en dur dans le code | **Faible** | ✅ |

---

## 1. Critiques

### C1 — Policies RLS `USING (true)` : l'isolation est neutralisée

**Fichiers** : [`00012_create_analyses.sql:23`](supabase/migrations/00012_create_analyses.sql#L23), [`00017_create_api_usage.sql:42`](supabase/migrations/00017_create_api_usage.sql#L42), [`00013_create_clients.sql:27`](supabase/migrations/00013_create_clients.sql#L27), `scripts/setup-database.sql:382-389`

```sql
CREATE POLICY "Service role full access" ON analyses FOR ALL USING (true) WITH CHECK (true);
```

**Aucune policy du projet ne comporte de clause `TO`** (vérifié : `grep -c "TO service_role\|TO authenticated"` sur les 18 migrations → 0). En PostgreSQL, une policy sans `TO` s'applique à `PUBLIC`, donc à `anon` et `authenticated`. Et les policies permissives **se combinent en OU logique** : les 4 policies correctes déclarées juste au-dessus ([`00012:18-21`](supabase/migrations/00012_create_analyses.sql#L18-L21), restreintes à `auth.uid() = user_id`) deviennent purement décoratives.

Le commentaire de [`00017:40`](supabase/migrations/00017_create_api_usage.sql#L40) — « Seul le service role lit/écrit… Aucun accès direct depuis le client » — décrit une intention **non implémentée**. Le `service_role` bypasse RLS nativement : cette policy ne lui sert à rien, elle ouvre juste la table à tout le monde.

**Scénario de défaillance.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` est publique par construction ([`client.ts:7`](src/lib/supabase/client.ts#L7)). N'importe quel visiteur l'extrait du bundle et interroge PostgREST directement :
- `analyses` en lecture → **toutes les analyses de tous les cabinets**. Or `analyses.query` contient la description de l'affaire rédigée par l'avocat et `analyses.response` l'analyse complète.
- `analyses` en écriture/suppression → altération ou effacement des analyses d'autrui.
- `api_usage` → liste des emails clients et des coûts.

**Portée.** C'est une divulgation d'informations couvertes par le **secret professionnel** (art. 226-13 du Code pénal, art. 2 du RIN) et une violation de données au sens de l'art. 33 RGPD. C'est le point le plus grave de l'audit.

Atténuation partielle : `clients` a été supprimée en migration 00016, sa policy est donc sans effet. `analyses` et `api_usage` sont bien actives.

**Correction** : supprimer ces policies (le service_role n'en a pas besoin) ou les restreindre par `TO service_role`. Vérifier ensuite en base :
```sql
select tablename, policyname, roles, qual from pg_policies where schemaname='public';
```

---

### C2 — `/api/chat` et `/api/clarify` : proxys LLM ouverts sur Internet

**Fichiers** : [`chat/route.ts:43-46`](src/app/api/chat/route.ts#L43-L46), [`clarify/route.ts:62-66`](src/app/api/clarify/route.ts#L62-L66)

Les deux routes appellent `supabase.auth.getUser()` **uniquement pour attribuer les coûts**, jamais pour bloquer :

- Dans `chat/route.ts`, `getUser()` est appelé **après** `getAnthropicClient()`, et `user` ne sert qu'au tracking. Il n'y a **aucun `if (!user)`** : le `anthropic.messages.stream()` part quel que soit l'appelant.
- Dans `clarify/route.ts`, l'appel Anthropic a lieu **avant** toute lecture de l'utilisateur ; `getUser()` n'apparaît qu'à la ligne 87, à l'intérieur d'un bloc de tracking `fail-silent`.

Le middleware ne rattrape rien : [`middleware.ts:44`](src/middleware.ts#L44) classe **tout** `/api/` comme route publique.

**Scénario de défaillance.** Deux endpoints POST publics relaient vers l'API Anthropic sur ta clé. `/api/chat` accepte un tableau `messages` arbitraire ([`chat/route.ts:63-66`](src/app/api/chat/route.ts#L63-L66)) — c'est un **proxy LLM générique gratuit**. Vecteurs : épuisement de budget, détournement du service, production de contenu arbitraire sous l'identité de l'infrastructure Datavocat. Ces requêtes atterrissent dans `api_usage` avec `user_id = null`.

**Correction** : `if (!user) return 401` en tête des deux routes, avant tout appel au modèle.

---

### C3 — Auto-approbation : le contrôle d'accès est contournable en une requête

**Fichiers** : [`middleware.ts:71`](src/middleware.ts#L71), [`register/page.tsx:31`](src/app/(auth)/register/page.tsx#L31), [`approve/route.ts:51-57`](src/app/api/admin/approve/route.ts#L51-L57), [`parametres/page.tsx:128`](src/app/(app)/parametres/page.tsx#L128)

Le flag d'approbation vit dans `auth.users.user_metadata` :
```ts
const isApproved = isAdmin || user.user_metadata?.approved === true;  // middleware.ts:71
```

**`user_metadata` est modifiable par l'utilisateur lui-même** via `supabase.auth.updateUser({ data: {...} })` avec la seule clé anon — c'est toute la distinction Supabase entre `user_metadata` (self-service) et `app_metadata` (service_role uniquement).

Le projet **appelle déjà cette API côté client** : [`parametres/page.tsx:128-133`](src/app/(app)/parametres/page.tsx#L128-L133). Un inscrit en attente rejoue la même requête avec `approved: true` et franchit immédiatement le contrôle. **Le flux de validation manuelle — cœur du contrôle d'accès du produit — tombe.**

**Bug fonctionnel associé (actif aujourd'hui).** `handleSaveProfile` envoie un objet `data` **partiel**, ce qui écrase l'intégralité de `user_metadata`. Un utilisateur approuvé qui modifie son profil **perd son flag `approved`** et se retrouve renvoyé en `/pending-approval`.

**Correction** : déplacer `approved` vers `app_metadata` (écrit via `admin.auth.admin.updateUserById`, déjà utilisé en `approve/route.ts:51`), lire `user.app_metadata?.approved` dans le middleware, retirer `approved: false` de l'inscription, et fusionner les métadonnées existantes dans `handleSaveProfile`.

---

### C4 — Le « taux de succès » ne mesure pas ce qu'il annonce

**Fichiers** : [`stats.ts:195-228`](src/lib/judilibre/stats.ts#L195-L228), [`stats.ts:404-416`](src/lib/judilibre/stats.ts#L404-L416), [`analyze-prompt.ts:99`](src/lib/claude/analyze-prompt.ts#L99)

C'est le risque produit majeur : il ne s'agit pas d'un bug, mais d'un **écart entre ce que la donnée permet et ce que l'interface promet**.

#### Ce que le code calcule réellement

`classifyOutcome()` lit le **dispositif** de la décision, pas l'issue **pour le justiciable** :

```ts
s.startsWith("infirme")  → "favorable"     // stats.ts:212
s.startsWith("confirme") → "defavorable"   // stats.ts:219
s.includes("cassation")  → "favorable"     // stats.ts:213
```

Trois problèmes distincts :

1. **En cour d'appel, « infirme » ≠ « le demandeur gagne ».** Infirmer un jugement donne tort au demandeur initial quand c'est l'adversaire qui a fait appel. **Judilibre n'expose pas qui est appelant** — l'information nécessaire au calcul est structurellement absente de la source.

2. **En cassation, « cassation » ≠ succès du justiciable.** Casser bénéficie au demandeur *au pourvoi*, qui est fréquemment le défendeur du procès initial. Le code le sait par ailleurs ([`stats.ts:723`](src/lib/judilibre/stats.ts#L723) précise « c'est un taux du juge du droit, pas un taux de succès au fond ») mais compte quand même `"cassation"` comme favorable dans `classifyOutcome`.

3. **Le corpus n'est pas un échantillon aléatoire.** C'est le top-N du moteur Judilibre reclassé sémantiquement — les décisions les plus *proches textuellement* de la requête, sur un fonds où les décisions de 1re instance sont très partiellement publiées (le prompt le reconnaît lui-même, section « Limites »). Un taux calculé là-dessus **n'est pas une probabilité**.

#### Ce que le produit en dit

Le prompt ordonne d'écrire littéralement :
> `"X% de chances de succes (calcule sur ...)"` — [`analyze-prompt.ts:99`](src/lib/claude/analyze-prompt.ts#L99)

Et le commentaire du code assume la même lecture : « chiffre canonique à afficher comme « % de chances » pour le client » ([`stats.ts:70`](src/lib/judilibre/stats.ts#L70)).

#### Surface de diffusion — 6 canaux

| Surface | Référence |
|---|---|
| Page principale (KPI) | [`page.tsx:796`](src/app/(app)/page.tsx#L796) |
| Historique | [`historique/[id]/page.tsx:256`](src/app/(app)/historique/[id]/page.tsx#L256) |
| Dashboard | [`dashboard.tsx:204`](src/components/analysis/dashboard.tsx#L204) |
| Slides (colorié comme un score de réussite) | [`slides.tsx:461-463`](src/components/analysis/slides.tsx#L461-L463) |
| Export PDF | [`export/pdf/route.ts:874`](src/app/api/export/pdf/route.ts#L874) |
| Export DOCX / XLSX | [`docx/route.ts:179`](src/app/api/export/docx/route.ts#L179), [`xlsx/route.ts:114`](src/app/api/export/xlsx/route.ts#L114) |

**Le chiffre part donc dans des livrables que l'avocat peut remettre à son client.**

#### Pourquoi c'est un risque et pas un détail

Le reste du produit est construit sur une promesse d'honnêteté statistique — anti-hallucination, sources vérifiées, refus de citer hors corpus. Un avocat qui découvre que le chiffre le plus visible mesure la propension de la juridiction à réformer plutôt que ses chances de gagner perd confiance dans **tout** le reste. S'y ajoute une exposition déontologique : présenter une statistique non fondée comme une prévision d'issue s'approche de la consultation juridique que le prompt s'interdit par ailleurs avec soin.

#### Options de correction (à arbitrer)

1. **Requalifier le libellé (effort faible, gain immédiat).** Remplacer « % de chances de succès » par ce qui est réellement mesuré : « taux de réformation observé dans le corpus » / « sens dominant des décisions analysées ». Aucune modification du calcul.
2. **Restreindre le périmètre (effort moyen).** Ne publier le taux que sur les sous-ensembles où le dispositif est interprétable sans connaître le rôle procédural, et afficher « non calculable » ailleurs — la mécanique existe déjà ([`stats.ts:407`](src/lib/judilibre/stats.ts#L407)).
3. **Passer à un intervalle avec n (effort moyen).** Afficher « 12/18 décisions favorables au demandeur — n=18 » plutôt qu'un pourcentage isolé, qui suggère une précision que l'échantillon ne porte pas.
4. **Abandonner le chiffre unique (effort élevé).** Le remplacer par la distribution des dispositifs, déjà calculée dans `bySolution`.

Recommandation : **1 + 3 immédiatement** (peu coûteux, retire l'essentiel de l'exposition), 2 et 4 à discuter ensuite.

---

### C5 — `patchAnnouncedCount` produit des pourcentages faux

**Fichier** : [`verify.ts:508-545`](src/lib/judilibre/verify.ts#L508-L545)

Quand la vérification supprime des lignes de tableau, `patchAnnouncedCount` réécrit l'effectif annoncé pour préserver l'invariant « Règle 1 ». Les 5 expressions régulières substituent `oldN → newN` dans « sur N décisions », « N décisions analysées », « Total : N »… **Aucune ne recalcule les pourcentages associés.**

**Scénario de défaillance :**
1. Claude écrit « Sur 40 décisions, 28 favorables (70 %) ».
2. La vérification supprime 5 lignes non vérifiables → `newN = 35`.
3. Le texte devient « Sur **35** décisions, 28 favorables (**70 %**) ».
4. Or 28/35 = **80 %**. Le rapport livré contient un pourcentage arithmétiquement faux.

**Le module chargé de garantir la véracité fabrique lui-même une erreur de calcul.** C'est d'autant plus problématique que le dispositif est invisible : `coherenceCorrected: true` est bien remonté, mais rien n'indique qu'un chiffre a pu devenir incohérent.

Aggravant : `announcedCount = corpus.length` ([`verify.ts:434`](src/lib/judilibre/verify.ts#L434)) compare le tableau nettoyé à **la taille du corpus**, pas au N que Claude a réellement annoncé. Avec `JUDILIBRE_TARGET_MAX = 700`, Claude ne produira jamais 700 lignes (impossible sous `max_tokens: 32000`) — donc le patch se déclenche presque systématiquement et réécrit des chiffres corrects.

**Correction** : soit recalculer les pourcentages en même temps que les effectifs, soit — plus sûr — ne pas patcher le texte et signaler l'incohérence à l'utilisateur, en s'appuyant sur les stats serveur qui sont, elles, exactes.

---

### C6 — Données fabriquées dans le pipeline Légifrance

**Fichiers** : [`multifond.ts:184`](src/lib/legifrance/multifond.ts#L184), [`multifond.ts:70`](src/lib/legifrance/multifond.ts#L70), [`multifond.ts:187`](src/lib/legifrance/multifond.ts#L187)

Trois inventions de données dans un produit dont la promesse centrale est de ne rien inventer :

1. **Chambre « soc » attribuée par défaut.**
   ```ts
   chamber: chamber || (jurisdiction === "cc" ? "soc" : "")
   ```
   Toute décision JURI de Cassation dont le titre ne mentionne pas la chambre est étiquetée **chambre sociale**. Elle entre ensuite dans `byChamber` ([`stats.ts:317`](src/lib/judilibre/stats.ts#L317)) et `chamberVariations` ([`stats.ts:527`](src/lib/judilibre/stats.ts#L527)). **Le rapport affiche « Chambre sociale : N décisions » en y incluant des décisions de chambre inconnue.**

2. **Dates reconstruites au 1er janvier.** `extractDateFromTitle` ([`multifond.ts:54-72`](src/lib/legifrance/multifond.ts#L54-L72)) : quand seule l'année est disponible, la date devient `YYYY-01-01`. Ces dates fictives alimentent `byYear`, `temporalTrend`, `freshDecisions` et `oldestDate` — produisant une concentration artificielle au 1er janvier dans toute analyse temporelle.

3. **`solution` systématiquement vide.** Le champ `solution` n'est jamais rempli par l'API Légifrance `/search`. Toutes les décisions JURI ont donc `solution: ""` → `classifyOutcome("")` retourne `"nuance"` ([`stats.ts:204`](src/lib/judilibre/stats.ts#L204)). Elles ne pèsent dans aucun taux **mais comptent dans tous les dénominateurs**. Ajouter 30 JURI à un corpus de 100 abaisse mécaniquement tout taux d'acceptation d'environ 23 %, sans que rien ne le signale.

Effet en cascade sur la fiabilité : ces « nuances » gonflent le dénominateur de `coherencePct` ([`stats.ts:385-394`](src/lib/judilibre/stats.ts#L385-L394)), qui pèse **35 %** de l'indice de fiabilité. Un défaut de parsing se transforme en verdict de fiabilité affiché à l'avocat.

---

## 2. Élevés

### E1 — Le rerank Haiku est cassé en silence sur les gros corpus

**Fichiers** : [`rerank.ts:118`](src/lib/judilibre/rerank.ts#L118), [`rerank.ts:145`](src/lib/judilibre/rerank.ts#L145), [`client.ts:942`](src/lib/judilibre/client.ts#L942)

Le chemin est direct, sans batching :
```ts
const candidates = uniqueDecisions.slice(0, JUDILIBRE_MAX_CONTEXT);  // client.ts:942 → jusqu'à 1000
const topDecisions = await rerankDecisions({ userQuery, decisions: candidates, ... });
```

`rerankDecisions` envoie les 1000 décisions à Haiku en **un seul appel**, avec `max_tokens: 4096`.

**Le calcul.** Chaque score sérialisé `{"i":123,"s":8},` coûte ~12-14 tokens. Pour 1000 décisions il faut **~13 000 tokens de sortie — plus de 3× le plafond**. Le seuil de rupture se situe autour de **300 décisions**.

**Chaîne de défaillance :**
1. La réponse est tronquée en plein JSON.
2. La regex `/\{[\s\S]*\}/` ([`rerank.ts:191`](src/lib/judilibre/rerank.ts#L191)) ne trouve pas d'objet fermé, ou `JSON.parse` lève.
3. Le `catch` retourne `null` ([`rerank.ts:213-215`](src/lib/judilibre/rerank.ts#L213-L215)).
4. Sans Voyage (`VOYAGE_API_KEY` est documentée « Optionnel »), fallback sur `decisions.slice(0, 700)` ([`rerank.ts:260`](src/lib/judilibre/rerank.ts#L260)) — **l'ordre mot-clé brut de Judilibre**.

**Conséquence.** Toute la sélection sémantique dont dépend la qualité du corpus est inopérante, **silencieusement**, précisément sur les matières à fort volume (licenciement, rupture conventionnelle, harcèlement) où elle compte le plus. Le coût Haiku est payé sans bénéfice. Rien dans l'UI ni les logs ne le signale.

**Correction** : batcher par ~150-200 décisions avec appels parallèles, ou augmenter `max_tokens` et compacter le format de sortie. Dans tous les cas, **rendre l'échec visible** (log + compteur dans `verification`) plutôt que muet.

### E2 — `/api/*` exclu du middleware : pas de contrôle `approved`

[`middleware.ts:44`](src/middleware.ts#L44) classe tout `/api/` en public. Les routes vérifient bien `user` individuellement (401 correct sur `analyze`, `analyses`, `export/*`, `rapport`, `feedback`), mais **aucune ne vérifie `approved`** (vérifié : `grep -rn "approved" src/app/api/` ne remonte que `admin/approve`).

Un inscrit non validé est bloqué sur l'interface mais peut appeler `/api/analyze` directement et consommer du budget Anthropic. Le processus de validation manuelle ne protège que l'UI, pas le produit.

### E3 — `CRON_SECRET` optionnel : fail-safe inversé

[`check-cph/route.ts:25-29`](src/app/api/cron/check-cph/route.ts#L25-L29) :
```ts
const expected = process.env.CRON_SECRET;
if (expected && auth !== `Bearer ${expected}`) { return 401 }
```
Si la variable n'est pas définie, le court-circuit sur `expected &&` **saute entièrement l'authentification** et la route devient publiquement déclenchable. Aucun `.env.example` ne documente cette variable — un déploiement neuf est exposé par défaut. Impact modéré (ping Judilibre + email vers une adresse en dur), mais le motif ne doit pas être répliqué.

### E4 — Aucun en-tête de sécurité, aucune CSP

[`next.config.ts`](next.config.ts) est vide. Absents : `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

**Nuance importante** : le rendu markdown via `dangerouslySetInnerHTML` (4 sites) est **correctement protégé** — `escapeHtml()` ([`format-markdown.ts:29-36`](src/lib/format-markdown.ts#L29-L36)) échappe les 5 caractères dangereux *avant* toute transformation, et le contenu vient de Claude, pas d'un tiers. Il s'agit donc d'une défense en profondeur manquante, pas d'une vulnérabilité active.

**Point positif** : `next.config.ts` ne désactive ni `typescript.ignoreBuildErrors` ni `eslint.ignoreDuringBuilds` — les erreurs bloquent le build.

### E5 — Aucune limite de débit

Aucun rate limiting nulle part. `@upstash/qstash` est en dépendance ([`package.json:18`](package.json#L18)) mais **aucun code ne l'importe** — dépendance morte. Combiné à C2 (routes LLM ouvertes) et à `maxDuration = 300`, le risque financier est direct : `/api/analyze` déclenche Judilibre + data.gouv + Sonnet sans quota par utilisateur. `/admin/costs` permet de **constater** la dérive, pas de la prévenir.

### E6 — Politique de confidentialité en décalage avec le code

[`confidentialite/page.tsx:37-42`](src/app/(legal)/confidentialite/page.tsx#L37-L42) décrit une section « Données clients » (nom, prénom, email, téléphone, entreprise) qui correspond **exactement** à la table `clients` ([`00013:6-11`](supabase/migrations/00013_create_clients.sql#L6-L11)) — **supprimée en migration 00016**. Idem [`cgu/page.tsx:110`](src/app/(legal)/cgu/page.tsx#L110).

Sur-déclaration d'un traitement inexistant (information inexacte au sens de l'art. 13 RGPD), et symétriquement **sous-déclaration de traitements réels** : `api_usage` (conservation de `user_email` en snapshot) et `judilibre_corpus` ne figurent nulle part.

Deux affirmations à corriger :
- [`confidentialite:119`](src/app/(legal)/confidentialite/page.tsx#L119) annonce « Row Level Security — isolation des données par utilisateur » : **factuellement faux** tant que C1 n'est pas corrigé.
- [`confidentialite:191`](src/app/(legal)/confidentialite/page.tsx#L191) affirme que les données ne sont « pas conservées par Anthropic au-delà du traitement » : dépend des conditions commerciales souscrites (rétention 30 jours par défaut hors ZDR) — à contractualiser ou reformuler.

### E7 — « 562 487 décisions » : un chiffre sans source, affiché comme preuve

**Fichiers** : [`page.tsx:418`](src/app/(app)/page.tsx#L418), [`(auth)/layout.tsx:38`](src/app/(auth)/layout.tsx#L38), [`sidebar.tsx:102`](src/components/layout/sidebar.tsx#L102), [`email/templates.ts:236`](src/lib/email/templates.ts#L236)

C'est une **constante littérale hardcodée**, jamais recalculée, jamais datée, jamais rapprochée d'un appel API. Elle apparaît 4 fois, dont 3 en position de preuve : dans la phrase de promesse du hero, dans le bandeau marketing de la page de connexion, et comme compteur « Base jurisprudence » dans la sidebar.

Le CLAUDE.md annonce lui-même « ~480K arrêts Cass. + 82K CA » = 562 000. **Le chiffre est donc une addition d'ordres de grandeur présentée à l'unité près.**

Sur un produit dont l'argument central est « ne jamais inventer de statistiques », c'est la contradiction la plus directement visible par un utilisateur.

Dans le même registre : la pastille « synchronisé » avec point pulsant ([`sidebar.tsx:110-118`](src/components/layout/sidebar.tsx#L110-L118)) n'a **aucun état derrière** — indicateur purement décoratif qui suggère une base vivante. Et le pourcentage de progression pendant l'analyse ([`page.tsx:1279-1285`](src/app/(app)/page.tsx#L1279-L1285)) est dérivé d'un timer calibré sur `localStorage`, **sans lien avec l'avancement réel** : l'utilisateur peut voir « 87 % — 9s » sur une analyse qui durera encore deux minutes.

### E8 — Des statistiques qui n'en sont pas

Trois chiffres publiés avec l'apparence de la jurimétrie, mais qui mesurent autre chose que ce que leur libellé annonce.

**1. « Taux de condamnation » article 700** — [`extractMontants.ts:208-212`](src/lib/judilibre/extractMontants.ts#L208-L212)
```ts
tauxCondamnation = art700DecisionCount / corpus.length × 100
```
Le numérateur compte les décisions dont **le sommaire mentionne l'art. 700 avec un montant à ±60 caractères**. Le dénominateur est le corpus entier — or les sommaires Judilibre résument la question de droit, pas le dispositif. C'est donc un **taux de détection textuelle**, publié sous le libellé « Taux de condamnation » ([`stats.ts:786`](src/lib/judilibre/stats.ts#L786)). Un avocat lira « 8 % de chances d'obtenir un article 700 » là où la réalité pratique avoisine 80 %.

À noter : la fenêtre de ±60 caractères est trop courte pour le cas nominal — « …au titre de l'article 700 du code de procédure civile la somme de 2 000 € » fait 78 caractères et **ne matche pas**.

**2. « Taux par argument juridique »** — [`stats.ts:574-600`](src/lib/judilibre/stats.ts#L574-L600)
Le champ `themes` de Judilibre est un **classement documentaire** (titrage matière), pas la liste des moyens invoqués par les parties. Le code compte « invoqué » = thème présent, « retenu » = décision favorable. **Il n'existe aucun lien causal entre le thème documentaire et le moyen qui a emporté la décision.** Le rapport présente pourtant « Harcèlement moral : 8 invoqués, 5 retenus (62 %) » comme un taux de succès par argument, et le prompt en fait une section obligatoire qui alimente les recommandations chiffrées.

C'est la statistique la plus susceptible d'induire en erreur : elle a l'apparence exacte d'une statistique de moyens sans en être une.

**3. « Variations régionales par cour d'appel »** — [`stats.ts:489-519`](src/lib/judilibre/stats.ts#L489-L519)
Le commentaire du code l'admet : Judilibre ne fournit pas le ressort. Le code construit alors `label = "CA " + d.chamber`. Les « variations régionales » sont donc des **variations par chambre, mal étiquetées** — et `chamberVariations` recalcule la même chose correctement 20 lignes plus bas. Le prompt ordonne pourtant à Claude d'« identifier explicitement la CA la plus favorable et la plus défavorable, avec l'écart en points » : **l'avocat lit un écart entre cours d'appel qui n'existe pas.**

**4. Points connexes.** `themeVariations` double-compte (`themes.slice(0,3)` : une décision alimente 3 accumulateurs, la somme des `total` dépasse le corpus). `temporalTrend` fait une régression OLS non pondérée : une année à 2 décisions pèse autant qu'une année à 200, avec un seuil de pente à 1,5 sans test de significativité. Et aucun intervalle de confiance n'est calculé nulle part — un taux sur n=5 (seuil retenu en [`stats.ts:409`](src/lib/judilibre/stats.ts#L409)) est publié avec la même autorité qu'un taux sur n=300, alors que son IC à 95 % est de ±44 points.

---

## 3. Moyens

### M1 — Timeouts serverless incohérents
`vercel.json` ne déclare que le cron — aucune section `functions`, aucune `regions`.
- `/api/analyze` : `maxDuration = 300` ([`analyze/route.ts:20`](src/app/api/analyze/route.ts#L20)) — **dépasse la limite du plan Hobby (60 s)**. Sur Hobby, la route serait coupée en plein stream.
- **`/api/rapport` n'a aucun `maxDuration`** alors qu'il appelle un LLM → hérite du défaut (10 s Hobby / 15 s Pro) et **échouera systématiquement**.
- Aucune `regions` : exécution par défaut à `iad1` (Washington) alors que Supabase est annoncé en UE — latence transatlantique à chaque requête, et argument de localisation UE affaibli.

### M2 — `src/types/database.ts` désynchronisé
La table `api_usage` et les colonnes `judilibre_corpus` / `verification` (migration 00018) sont absentes des types. Le code contourne par des casts `as unknown` ([`track.ts:82-91`](src/lib/api-usage/track.ts#L82-L91), [`analyze/route.ts:322-330`](src/app/api/analyze/route.ts#L322-L330)), ce qui annule le bénéfice du `strict: true`. Une faute de frappe sur un nom de colonne passerait la compilation et échouerait silencieusement — les deux sites sont fail-silent.

### M3 — Aller-retour des stats par le langage naturel
Architecture fragile : le serveur **calcule** les stats de façon fiable (`stats.ts`), demande à Claude de les **réciter en markdown**, puis les **re-parse par regex** (`parse-analysis.ts`) pour les afficher — alors que la donnée existait déjà en structuré côté serveur.

Exemple concret : [`parse-analysis.ts:907`](src/lib/parse-analysis.ts#L907), le fallback `/(\d+)\s+décision/i` capture **le premier nombre suivi de « décision » dans tout le document**. Si l'intro dit « 1 250 décisions trouvées au total, 47 analysées », `echantillon` devient 1250 — or il alimente l'indice de fiabilité.

Un correctif partiel existe ([`page.tsx:115-118`](src/app/(app)/page.tsx#L115-L118) écrase `tauxSuccesGlobal` par la valeur serveur), mais il ne couvre que le taux, pas `echantillon` ni `arguments`, et pas toutes les surfaces — les slides lisent encore la valeur parsée ([`slides.tsx:461`](src/components/analysis/slides.tsx#L461)).

**Direction** : faire transiter les stats structurées du serveur au client (elles sont déjà persistées dans `analyses.verification`) et réserver le markdown à la prose.

### M4 — Aucun test, aucune CI, aucune observabilité
- **Tests** : zéro fichier `*.test.*`, aucun runner installé. Zéro couverture sur `stats.ts`, `verify.ts`, `parse-analysis.ts`, `track.ts` — soit exactement les modules où une erreur est invisible.
- **CI** : pas de `.github/workflows`. `package.json` n'expose que `lint`, sans `typecheck` ni `test`.
- **Observabilité** : aucun Sentry/PostHog/OTel. Le diagnostic repose sur 29 `console.*` visibles seulement dans les logs Vercel.
- Combiné aux `catch` fail-silent, une panne de tracking des coûts ou d'envoi d'email est **totalement invisible**.

### M5 — Mentions légales incomplètes
Placeholders non remplis en production : `[adresse complète]` ([`mentions-legales:18`](src/app/(legal)/mentions-legales/page.tsx#L18), [`confidentialite:16`](src/app/(legal)/confidentialite/page.tsx#L16)), `[Nom du directeur]` ([`mentions-legales:26`](src/app/(legal)/mentions-legales/page.tsx#L26)). Ni SIREN/SIRET, ni TVA. L'art. 6-III LCEN impose dénomination, siège et directeur de publication.

### M6 — Rétention annoncée mais non implémentée
[`confidentialite:57-84`](src/app/(legal)/confidentialite/page.tsx#L57-L84) annonce « durée du compte + 1 an » et « 26 mois (anonymisées) ». **Aucun mécanisme correspondant** : pas de cron de purge, pas de `deleted_at`, pas d'anonymisation.
- `analyses` : `ON DELETE CASCADE` → purge correcte à la suppression du compte ✅
- `api_usage` : `user_email` **conservé délibérément** ([`00017:11`](supabase/migrations/00017_create_api_usage.sql#L11)) — contredit le droit à l'effacement (art. 17 RGPD) annoncé en `confidentialite:131`.
- Le droit à l'effacement est manuel ([`parametres/page.tsx:416`](src/app/(app)/parametres/page.tsx#L416) renvoie vers un email).

### M7 — `scripts/setup-database.sql` : schéma mort et dangereux
Dump consolidé de l'état **pré-00016** : recrée `decisions`, `stats_cache`, les vues et policies supprimées. **L'exécuter sur la prod ressusciterait le schéma mort avec ses policies `USING (true)`.** Idem `00011_seed_data.sql`, qui insère des décisions fictives dans une table désormais supprimée.

---

### M8 — Code mort massif (~2 800 lignes) et garde-fous débranchés

**Le plus significatif : `slides.tsx` (2217 l.) n'est importé nulle part.** `grep -rn "AnalysisSlides\|analysis/slides" src/` ne remonte que sa propre déclaration. C'est aussi **la seule raison pour laquelle `recharts` est en dépendance**.

| Élément | Volume | Note |
|---|---|---|
| `components/analysis/slides.tsx` | 2217 l. | Non importé. Seul consommateur de `recharts`. |
| `lib/datagouv/client.ts` | 116 l. | Aucun appelant (doublon de `mcp-client.ts`). |
| `lib/claude/extraction-prompt.ts` | 88 l. | Aucun appelant — vestige de l'ancien produit. |
| `components/analysis/citation-link.tsx` | 90 l. | Non importé. |
| `/api/rapport` + `rapport-prompt.ts` | ~170 l. | **Route morte mais exposée**, avec interpolation non validée du body client dans le prompt → injection de prompt. |
| `globals.css` thèmes jurimetrie/palais | ~100 l. | Neutralisés activement par `theme-provider.tsx:14`. |
| `lib/demo.ts` | 8 l. | Non importé + **email personnel et UUID de production en clair**. |
| deps `d3`, `@types/d3`, `@upstash/qstash` | — | Zéro import dans `src/`. |
| Divers | ~150 l. | `getDecision`, `getTaxonomy`, `getArticle`, `detectHallucinationRisk`, `normalizeNum` (no-op)… |

**Plus grave que du code mort : un garde-fou anti-hallucination débranché.**
`extractSources(text, corpus)` ([`parse-analysis.ts:236`](src/lib/parse-analysis.ts#L236)) ne filtre les sources que si `corpus` lui est passé. **Aucun appelant ne le passe** — ni [`page.tsx:102`](src/app/(app)/page.tsx#L102), ni [`historique/[id]/page.tsx:119`](src/app/(app)/historique/[id]/page.tsx#L119) — alors que le corpus **est persisté en base** (`judilibre_corpus`). Les ~110 lignes de vérification (`checkRefFn`, `corpusById`, `yearAround`) ne s'exécutent donc jamais : les sources affichées sont extraites par regex brute, sans contrôle. La chaîne anti-hallucination est complète côté serveur mais **coupée côté affichage**.

### M9 — Volumétrie API non budgétée et travail abandonné qui continue de coûter

**Jusqu'à ~200 requêtes PISTE par analyse.** 8 requêtes (5 base + 3 enrichissements) × 4 juridictions × 5 pages ≈ 160, plus les fallbacks, le rééquilibrage et les 3 niveaux d'élargissement. Sans limite de concurrence, sans rate limiter, et **sans timeout par requête** ([`client.ts:195`](src/lib/judilibre/client.ts#L195) n'a ni `signal` ni `AbortSignal.timeout`). En charge, les 429 de PISTE sont avalés par les `.catch()` individuels : le corpus rétrécit sans qu'aucun signal ne remonte.

**Le `Promise.race` de 60 s fuit.** Quand le timer gagne ([`analyze/route.ts:98-100`](src/app/api/analyze/route.ts#L98-L100)), `searchJudilibreForAnalysis` **continue de tourner en arrière-plan** avec ses ~200 requêtes et son appel Haiku facturé, dont le résultat est jeté. Coût payé, valeur nulle.

**Voyage n'est jamais tracké.** `semanticScores` peut déclencher jusqu'à 11 appels séquentiels ([`voyage.ts:83-88`](src/lib/embeddings/voyage.ts#L83-L88)) sans aucun `trackClaudeUsage`. **`/admin/costs` sous-estime donc structurellement le coût réel par analyse.**

**Aucun cache de recherche.** Deux avocats posant la même question relancent l'intégralité du pipeline. Le seul `revalidate` du codebase est... sur du code mort (`datagouv/client.ts`).

**Sous-comptage des analyses interrompues.** `stream.finalMessage()` ([`analyze/route.ts:441`](src/app/api/analyze/route.ts#L441)) n'est atteint qu'après consommation complète du stream : si le client se déconnecte, l'usage n'est pas tracké **alors qu'Anthropic facture**.

### M10 — Accessibilité : les primitives accessibles existent mais ne sont pas branchées

Le projet contient ~1 400 lignes de primitives `@base-ui/react` accessibles — `ui/dialog.tsx`, `ui/dropdown-menu.tsx`, `ui/tabs.tsx`, `ui/select.tsx`, `ui/tooltip.tsx` — **systématiquement contournées** par des reconstructions maison inaccessibles :
- **4 implémentations d'onglets** en `<button>` nus (`page.tsx:848`, `historique/[id]:302`, `parametres:131`, `admin-nav:17`) : aucun `role="tablist"`, aucun `aria-selected`, aucune navigation par flèches.
- Dropdown du header, modale de feedback, palette ⌘K, popover de fiabilité : **aucun focus trap**, pas de `role="dialog"`, pas de restauration du focus.
- ~16 attributs `aria-*` réellement rendus sur tout le projet ; 2 `sr-only`.
- Aucun skip link ; aucun `aria-live` sur les changements de phase (input → clarify → analyzing → done) — un utilisateur de lecteur d'écran ne reçoit **aucune notification** de progression.

**Le correctif est déjà écrit, il n'est simplement pas utilisé.**

### M11 — Erreurs réseau silencieuses côté client

- [`historique/page.tsx:78`](src/app/(app)/historique/page.tsx#L78) : `.catch(() => setLoading(false))` → une coupure réseau produit **exactement le même écran que « aucune analyse »**. L'utilisateur croit avoir perdu ses données.
- [`historique/[id]/page.tsx:110-114`](src/app/(app)/historique/[id]/page.tsx#L110-L114) : `setAnalysis(data)` **sans vérifier `res.ok`** → un 500 renvoyant `{error}` produit un objet tronqué, puis un crash au rendu.
- [`parametres/page.tsx:45`](src/app/(app)/parametres/page.tsx#L45) : `if (!error) { setSaved(true) }` — **le cas d'erreur n'affiche rien**. L'échec de sauvegarde du profil est totalement silencieux.
- [`page.tsx:217-222`](src/app/(app)/page.tsx#L217-L222) : le message d'échec est injecté dans `setResponse` puis `setPhase("done")` → il traverse le parseur et s'affiche comme **un rapport vide avec « — % » de taux de succès**, au lieu d'un état d'erreur.

### M12 — Product tour cassé et français dégradé sur les surfaces de première impression

**Le tour référence 2 cibles inexistantes** : `tour-welcome` et `fiabilite-badge` ne sont définis nulle part dans le DOM (le second devrait être sur `page.tsx:1059`). `nav-historique` existe mais dans la sidebar `hidden lg:flex` — donc invisible sous 1024 px. L'étape finale renvoie vers « Paramètres > Aide & Tutoriel », **qui n'existe pas** (les onglets réels sont Profil/Sécurité/Légal) — le tour n'est donc pas relançable.

**Textes sans accents sur les surfaces les plus visibles** :
- Les **3 exemples de saisine de la page d'accueil** ([`page.tsx:384-386`](src/app/(app)/page.tsx#L384-L386)) — premier contenu que lit un avocat — alors que le `placeholder` juste à côté est parfaitement accentué.
- Les **11 étapes du tutoriel** ([`use-product-tour.ts:33-116`](src/hooks/use-product-tour.ts#L33-L116)), déclenché juste après l'inscription.
- Les **2 écrans d'erreur génériques** : « Nous nous excusons pour la gene occasionnee… Veuillez reessayer » (`(app)/error.tsx:26-31`, `(auth)/error.tsx:25-29`).

**Incohérence sur l'indice de fiabilité** : « 8 facteurs » (`page.tsx:1142`), « 7 critères » (`use-product-tour.ts:71`), **4 facteurs réellement calculés** (A/B/C/D). Trois chiffres pour la même chose.

**La vue historique est moins transparente que la vue live** : `FiabiliteBar` y est dupliqué en version amputée ([`historique/[id]/page.tsx:34-72`](src/app/(app)/historique/[id]/page.tsx#L34-L72)) — **le garde-fou « l'indice n'est PAS un pronostic d'issue » disparaît** — et `AnalysisDashboard` est appelé sans `meta`, supprimant le bandeau volumétrie. Un rapport archivé, donc plus daté, est présenté avec **moins** de réserves qu'un rapport frais.

---

## 4. Faibles

- **F1 — Mot de passe** : minimum 6 caractères ([`parametres/page.tsx:148`](src/app/(app)/parametres/page.tsx#L148)), sous les recommandations CNIL. Le formulaire collecte `passwordForm.current` mais **ne le vérifie jamais** — quiconque dispose d'une session active peut changer le mot de passe sans connaître l'actuel. Pas de MFA alors que la cible le justifierait.
- **F2 — Monolithes** : `slides.tsx` (2217 l.), `page.tsx` (1451 l.), `parse-analysis.ts` (1119 l.), `evidence-table.tsx` (1117 l.), `client.ts` (1043 l.).
- **F3 — README** : template `create-next-app` non modifié. Aucune instruction d'installation, aucun `.env.example` pour 19 variables. Un nouveau développeur ne peut pas démarrer le projet.
- **F4 — Email personnel en dur** : `thomasaubigeon@gmail.com` dans [`check-cph/route.ts:18`](src/app/api/cron/check-cph/route.ts#L18) et [`demo.ts:4`](src/lib/demo.ts#L4).
- **Divers** : index `idx_cabinets_slug` redondant (`slug` déjà UNIQUE) ; `profiles.cabinet_id` sans `ON DELETE` (suppression de cabinet bloquée) ; `getAuthContext()` lit `profiles` à chaque export pour un `cabinetId` jamais utilisé ; un admin peut se révoquer lui-même.

---

## 5. Ce qui est bien

À préserver — plusieurs de ces points sont au-dessus de ce qu'on voit habituellement.

1. **Discipline TypeScript exemplaire** : **0 `any`, 0 `@ts-ignore`, 0 `catch` vide, 1 seul commentaire résiduel** sur 25 000 lignes. `strict: true` actif et non contourné au build.
2. **Anti-hallucination à plusieurs étages** — le vrai actif du produit :
   - stats calculées serveur et injectées comme « FAITS VÉRIFIÉS » à réciter ([`stats.ts:630`](src/lib/judilibre/stats.ts#L630)) ;
   - vérification post-génération qui **supprime** les phrases citant une référence hors corpus ([`verify.ts`](src/lib/judilibre/verify.ts)) ;
   - `verify.ts` croise numéro × juridiction × année avec raison de rejet typée, et distingue correctement un RG de CA d'un pourvoi de Cassation ([`verify.ts:65-74`](src/lib/judilibre/verify.ts#L65-L74)) — pièce la plus rigoureuse du codebase ;
   - prompt qui interdit explicitement les alibis (« jurisprudence constante », tags `[Connaissance consolidée]`).
3. **Conformité juridique pensée en amont** : interdiction du profilage de magistrats (art. 33 loi 2019-222) appliquée **à la fois** dans le prompt et par `stripMagistratNames()` ([`client.ts:44`](src/lib/judilibre/client.ts#L44)) ; respect du monopole du conseil (loi 71-1130) via un vocabulaire imposé.
4. **Hygiène des secrets irréprochable** : aucun `.env`/`.pem` jamais commité sur 144 commits, toutes branches. Aucune clé en dur. `SUPABASE_SERVICE_ROLE_KEY` isolé dans `admin.ts`, jamais importé par un composant client.
5. **Autorisation admin en triple garde** : middleware + `admin/layout.tsx` + vérification par route. **Aucun contournement identifié** — c'est le point le plus solide du projet.
6. **Vérification d'ownership là où RLS est contournée** : [`analyze/route.ts:57-63`](src/app/api/analyze/route.ts#L57-L63) relit `user_id` avant update et double le filtre par `.eq("user_id", user.id)`, alors même que le service_role bypasse RLS. Bon réflexe.
7. **Réduction délibérée de la surface de données personnelles** : la migration 00016 supprime `clients` et `decisions`. Plus aucune donnée nominative de client final n'est stockée — meilleure décision RGPD du projet, documentée avec lucidité dans `.planning/sources-audit.md`.
8. **Validation stricte sur les mutations** : [`analyses/[id]/route.ts:45-58`](src/app/api/analyses/[id]/route.ts#L45-L58) utilise une allowlist de champs et valide l'énumération — pas de mass assignment.
9. **Traçabilité auditable** : la migration 00018 stocke le corpus source et les métriques de vérification — dispositif rare et pertinent pour un outil juridique.
10. **Suivi des coûts dès le départ** : `api_usage` + `/admin/costs`. Les tarifs Sonnet 4 / Haiku 4.5 sont exacts et le calcul cache read/write est correct ([`track.ts:44-52`](src/lib/api-usage/track.ts#L44-L52)).
11. **Résilience réseau** : timeouts et `Promise.race` sur Judilibre (60 s) et data.gouv (8 s) ; sources secondaires en fail-silent assumé.
12. **Prompt caching Anthropic** activé sur tous les system prompts — économie réelle.
13. **Échappement XSS correct** avant rendu markdown ([`format-markdown.ts:29`](src/lib/format-markdown.ts#L29)).
14. **Pas d'open redirect** : [`auth/callback/route.ts:13`](src/app/auth/callback/route.ts#L13) ancre la redirection sur `origin`.
15. **Documentation d'architecture honnête** : `.planning/sources-audit.md` expose sans complaisance les limites (dépendance PISTE unique, pas de permalien stable, doublons Légifrance/Judilibre).

---

## 6. Roadmap proposée

Ordonnée par (impact × risque) / effort. À arbitrer ensemble.

### Palier 0 — Avant tout nouvel utilisateur
| | Action | Effort |
|---|---|---|
| 1 | **C1** — supprimer les policies `USING (true)` sur `analyses` et `api_usage` | ~15 min |
| 2 | **C2** — `if (!user) return 401` sur `/api/chat` et `/api/clarify` | ~15 min |
| 3 | **C3** — `approved` → `app_metadata` + corriger l'écrasement de métadonnées | ~1 h |
| 4 | **E3** — rendre `CRON_SECRET` obligatoire | ~5 min |

Ces quatre points ferment l'exposition du secret professionnel et de la facturation. Coût total : une demi-journée.

### Palier 1 — Véracité des chiffres
C'est le palier qui protège la crédibilité du produit. Tout y touche à ce que l'avocat lit comme un fait.

| | Action | Effort |
|---|---|---|
| 5 | **C5** — corriger `patchAnnouncedCount` (recalculer les % ou ne pas patcher) | ~2 h |
| 6 | **C6** — retirer les données fabriquées : chambre par défaut, date au 1er janvier ; exclure les JURI sans `solution` des dénominateurs | ~half-day |
| 7 | **C4** — requalifier le taux (options 1+3) sur les 6 surfaces | ~half-day |
| 8 | **E8** — renommer ou retirer les 3 fausses statistiques (art. 700, argument, régional) | ~half-day |
| 9 | **E7** — remplacer « 562 487 » par un chiffre sourcé ou une formulation honnête ; retirer la pastille « synchronisé » | ~1 h |
| 10 | **E1** — batcher le rerank + rendre l'échec visible | ~half-day |
| 11 | **M8** — rebrancher le filtre corpus dans `extractSources` | ~1 h |
| 12 | **M4** — tests sur `stats.ts`, `verify.ts`, `parse-analysis.ts` | ~1-2 j |

L'ordre importe : écrire les tests **en dernier** fige le comportement corrigé plutôt que le comportement actuel.

### Palier 2 — Robustesse et coûts
| | Action |
|---|---|
| 13 | **E2** — contrôle `approved` sur les routes LLM |
| 14 | **E5 / M9** — rate limiting + plafond par utilisateur ; tracker Voyage ; `AbortController` sur le travail abandonné |
| 15 | **M9** — cache des recherches Judilibre (deux requêtes identiques ne doivent pas relancer 200 appels) |
| 16 | **E4** — en-têtes de sécurité + CSP |
| 17 | **M1** — `maxDuration` sur `/api/rapport`, aligner `analyze`, `regions` UE |
| 18 | **M2** — régénérer `database.ts`, supprimer les casts |
| 19 | CI GitHub Actions (`tsc --noEmit` + `eslint`) + Sentry |
| 20 | **M11** — distinguer les états d'erreur réseau des états vides |

### Palier 3 — Conformité, UX et dette
| | Action |
|---|---|
| 21 | **E6 / M5 / M6** — aligner les pages légales sur le code, remplir les mentions, implémenter la rétention |
| 22 | **M8** — supprimer le code mort (~2 800 l.) : `slides.tsx`, `/api/rapport` (route exposée !), `datagouv/client.ts`, `demo.ts`, deps `d3`/`recharts`/`qstash` |
| 23 | **M12** — corriger le tour (2 cibles manquantes, entrée Paramètres inexistante) + accents sur accueil/tour/erreurs |
| 24 | **M12** — aligner la vue historique sur la vue live (garde-fou fiabilité, `meta`) |
| 25 | **M10** — brancher les primitives base-ui existantes (onglets, dialog, dropdown) |
| 26 | **M7** — archiver `setup-database.sql` et `00011_seed_data.sql` |
| 27 | **M3** — faire transiter les stats structurées au lieu de re-parser le markdown |
| 28 | **F2** — découper les monolithes |
| 29 | **F3** — README + `.env.example` |
| 30 | Trancher le sort de `cabinets`/`profiles` : réactiver le multi-tenant ou supprimer le code mort |

---

## 7. Méthode et limites de cet audit

**Ce qui a été fait** : lecture directe de tous les fichiers critiques ; vérification indépendante de chaque point Critique et Élevé ; balayage systématique des 18 migrations pour le motif RLS ; comptage réel de la dette (`any`, `TODO`, `console`, tests).

**Ce qui n'a pas été fait** — et qui reste à vérifier avant de conclure définitivement :
- **Aucune exécution** : ni build, ni requête Judilibre réelle, ni test en base. La troncature du rerank (E1) est établie par calcul de tokens, pas par mesure — l'ordre de grandeur est net (3× le plafond), mais le seuil exact de ~300 décisions est une estimation.
- **L'état réel de la base de production n'a pas été inspecté.** Les policies ont pu être modifiées à la main depuis. À confirmer par la requête `pg_policies` donnée en C1 avant toute conclusion sur l'exposition effective.
- **Le plan Vercel n'est pas vérifiable depuis le dépôt** — M1 dépend de cette information.
- Les rapports d'agents ont couvert le frontend/UX plus superficiellement que le backend ; un passage dédié accessibilité et responsive reste à faire.

---

## 8. Suivi des corrections (13 août 2026)

Branche `audit/corrections-completes` — 5 commits.

### Palier 0 — Exposition · `ceb6dfa`

| Constat | État | Traitement |
|---|:--:|---|
| **C1** RLS `USING (true)` | ✅ | Migration `00019` : policies supprimées sur `analyses`, `api_usage`, `clients`. Le `service_role` bypasse RLS nativement. **À appliquer en base.** |
| **C2** `/api/chat` et `/api/clarify` ouverts | ✅ | `requireApprovedUser()` avant tout appel au modèle + validation de forme et de taille des payloads |
| **C3** Auto-approbation | ✅ | `approved` migré vers `app_metadata` ; `user_metadata` lu en rétro-compat ; écrasement des métadonnées corrigé |
| **E3** `CRON_SECRET` optionnel | ✅ | Fail-safe inversé en refus |

### Palier 1 — Véracité des chiffres · `6e3a6c6`

| Constat | État | Traitement |
|---|:--:|---|
| **C5** Pourcentages faux | ✅ | `patchAnnouncedCount` supprimé, remplacé par un avertissement. `countTableRows` cible le tableau de preuve |
| **C6** Données fabriquées | ✅ | Chambre par défaut et dates au 1<sup>er</sup> janvier retirées ; décisions sans dispositif exclues des dénominateurs |
| **C4** Taux de succès | ✅ | Renommé « issues favorables dans ce corpus » sur les 6 surfaces, avec n et marge à 95 %. Seuil 5 → 15. Réserve co-localisée. Prompt et encadré PDF corrigés |
| **E8** Fausses statistiques | ✅ | Taux art. 700 supprimé ; « arguments » → « thèmes de classement » (seuil 2 → 5) ; variations régionales désactivées |
| **E7** « 562 487 décisions » | ✅ | Remplacé par les sources nommées ; pastille « synchronisé » retirée |
| **E1** Rerank tronqué | ✅ | Batché à 150/appel, échecs partiels tolérés et journalisés. Corpus max 700 → 200 |
| **M8** Filtre sources débranché | ✅ | Corpus transmis au parseur sur l'historique |
| **M4** Aucun test | ✅ | Vitest + 22 tests sur `stats.ts` et `verify.ts` |

### Palier 2 — Robustesse · `cd4df77`

| Constat | État | Traitement |
|---|:--:|---|
| **E2** Pas de contrôle `approved` | ✅ | Appliqué sur `/api/analyze` |
| **E5** Aucun rate limiting | ✅ | Quotas horaires par utilisateur adossés à `api_usage` (analyze 20, chat 120, clarify 60) |
| **E4** Aucun en-tête de sécurité | ✅ | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| **M1** Timeouts serverless | ✅ | `maxDuration` par route, région `cdg1` |
| **M2** Types désynchronisés | ✅ | `api_usage`, `judilibre_corpus`, `verification` typés ; casts `as unknown` retirés |
| **M8** Code mort | ✅ | ~2 800 lignes supprimées, dont `/api/rapport` (exposée, injection de prompt). Deps `recharts`, `d3`, `qstash` retirées |
| **M4** Aucune CI | ✅ | GitHub Actions : typecheck + lint + tests |

### Palier 3 — Conformité et UX · `3ccb990` + `d2060ac`

| Constat | État | Traitement |
|---|:--:|---|
| **E6** Politique obsolète | ✅ | Section « Données clients » remplacée ; `api_usage` et `judilibre_corpus` déclarés ; affirmations RLS et Anthropic corrigées |
| **M5** Mentions légales | ⚠️ | Placeholders remplacés par des variables `NEXT_PUBLIC_LEGAL_*` — **à renseigner** |
| **M12** Tour cassé | ✅ | Cibles corrigées, étape invisible retirée, accents rétablis, « 8 facteurs » → valeur réelle |
| **M11** Erreurs silencieuses | ✅ | États d'erreur distincts des états vides, avec bouton Réessayer |
| **M10** Accessibilité | ✅ | Onglets ARIA + navigation clavier, menus labellisés, fermeture Échap, `aria-live` sur les phases |
| **F1** Mot de passe | ✅ | Ré-authentification exigée ; seuil 6 → 12 caractères |
| **F3** README | ✅ | README et `.env.example` rédigés |

### Reste à traiter

Points identifiés mais volontairement laissés de côté — ils ne présentent pas de
risque immédiat et méritent d'être traités posément :

- **M6** Rétention RGPD annoncée mais non implémentée (purge, anonymisation).
  Le droit à l'effacement reste manuel — acceptable si le délai d'un mois est tenu.
- **M7** `scripts/setup-database.sql` et `00011_seed_data.sql` à archiver.
- **M3** Aller-retour des stats par le markdown : atténué (le serveur fait
  autorité sur le taux), mais l'architecture reste à revoir.
- **F2** Monolithes à découper — c'est là que vivent les 18 erreurs de lint
  préexistantes, d'où le `continue-on-error` de la CI.
- Multi-tenant : trancher le sort de `cabinets`/`profiles`, aujourd'hui morts.

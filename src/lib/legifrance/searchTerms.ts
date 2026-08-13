/**
 * Extraction des termes significatifs d'une demande d'avocat, pour interroger
 * les fonds Légifrance.
 *
 * Contexte : les recherches Légifrance étaient construites en passant la
 * phrase entière de l'avocat, avec `typeRecherche: "EXACTE"` (CETAT) ou
 * `"TOUS_LES_MOTS_DANS_UN_CHAMP"` (JURI, KALI). Dans les deux cas, aucune
 * décision ne peut correspondre à une phrase rédigée librement : la recherche
 * renvoyait systématiquement zéro résultat, en silence. Le contentieux
 * administratif et le fonds historique étaient donc absents de tous les
 * corpus, alors que l'API expose plus de 570 000 décisions CETAT.
 */

/**
 * Mots vides du français courant et du vocabulaire de saisine, sans valeur
 * discriminante pour une recherche jurisprudentielle.
 */
const STOPWORDS = new Set([
  // Articles, pronoms, prépositions
  "mon", "mes", "son", "ses", "leur", "leurs", "cette", "cet", "ces", "elle",
  "elles", "nous", "vous", "dans", "pour", "avec", "sans", "sous", "chez",
  "entre", "vers", "depuis", "apres", "après", "avant", "contre", "devant",
  "les", "des", "une", "aux", "que", "qui", "est", "par", "sur", "aux",
  "quel", "quels", "quelle", "quelles", "dont", "donc", "mais", "plus",
  // Vocabulaire de saisine, non discriminant
  "client", "cliente", "conteste", "contester", "affaire", "dossier",
  "jurisprudence", "retient", "motif", "invoque", "situation", "question",
  "sont", "peut", "doit", "faire", "avoir", "etre", "être", "cas",
  // Noms de juridictions. Ils désignent le FORUM, pas la matière : les
  // laisser dans la requête plein texte fait remonter les décisions dont le
  // titre porte ce mot plutôt que celles qui traitent du sujet. Observé en
  // réel : « tribunal administratif » ramenait 50 décisions du Tribunal des
  // conflits et aucune du Conseil d'État. Le ciblage de juridiction se fait
  // par le fonds interrogé (CETAT) et par les filtres, pas par le texte.
  "tribunal", "administratif", "administrative", "conseil", "cour",
  "appel", "cassation", "chambre", "juridiction", "instance", "devant",
  "recours", "juge", "magistrat", "formation",
]);

/**
 * Extrait les termes significatifs d'une requête en langage naturel.
 *
 * @param query   demande brute de l'avocat
 * @param maxTerms nombre maximum de termes conservés (défaut 12)
 * @returns une chaîne de mots-clés séparés par des espaces, exploitable en
 *          `UN_DES_MOTS`. Si aucun terme n'est extractible, retourne un
 *          extrait tronqué de la requête plutôt qu'une chaîne vide.
 */
export function extractLegifranceTerms(query: string, maxTerms = 12): string {
  const terms = query
    .toLowerCase()
    // On conserve les lettres accentuées, on écarte chiffres et ponctuation :
    // un numéro d'article n'aide pas une recherche plein texte de décisions.
    .replace(/[^a-zà-ÿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  const unique = [...new Set(terms)].slice(0, maxTerms);
  return unique.length > 0 ? unique.join(" ") : query.slice(0, 120);
}

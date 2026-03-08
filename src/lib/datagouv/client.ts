/**
 * Client data.gouv.fr — recherche de décisions de justice via l'API REST
 * et le endpoint JUDILIBRE (Cour de cassation)
 */

const DATAGOUV_API = "https://www.data.gouv.fr/api/1";

export interface DatagouvDataset {
  id: string;
  title: string;
  description: string;
  organization?: { name: string };
  resources: Array<{
    id: string;
    title: string;
    format: string;
    url: string;
    filesize: number;
  }>;
}

export async function searchDatasets(query: string, limit = 5): Promise<DatagouvDataset[]> {
  const url = `${DATAGOUV_API}/datasets/?q=${encodeURIComponent(query)}&page_size=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function getDatasetResources(datasetId: string) {
  const url = `${DATAGOUV_API}/datasets/${datasetId}/`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Search for court decision datasets related to a legal topic
 */
export async function searchCourtDecisions(topic: string): Promise<string> {
  // Search multiple queries to maximize results
  const queries = [
    `décisions justice ${topic}`,
    `jurisprudence ${topic}`,
    `JUDILIBRE ${topic}`,
    `arrêts ${topic}`,
  ];

  const allDatasets: DatagouvDataset[] = [];
  const seenIds = new Set<string>();

  for (const q of queries) {
    const datasets = await searchDatasets(q, 3);
    for (const ds of datasets) {
      if (!seenIds.has(ds.id)) {
        seenIds.add(ds.id);
        allDatasets.push(ds);
      }
    }
  }

  // Format for Claude context
  if (allDatasets.length === 0) {
    return "Aucun jeu de données trouvé sur data.gouv.fr pour ce sujet.";
  }

  return allDatasets
    .slice(0, 8)
    .map((ds) => {
      const org = ds.organization?.name || "Inconnu";
      const resources = ds.resources
        ?.slice(0, 3)
        .map((r) => `  - ${r.title} (${r.format}, ${r.url})`)
        .join("\n") || "  (aucune ressource)";
      return `## ${ds.title}\nOrganisation: ${org}\n${ds.description?.slice(0, 300)}\nRessources:\n${resources}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Try to fetch and sample data from a CSV/JSON resource on data.gouv.fr
 */
export async function sampleResourceData(resourceUrl: string, maxRows = 50): Promise<string> {
  try {
    const res = await fetch(resourceUrl, {
      headers: { "Accept": "text/csv, application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return `Erreur ${res.status} lors du téléchargement.`;

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (contentType.includes("json")) {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.results || data.data || [];
      return JSON.stringify(items.slice(0, maxRows), null, 2);
    }

    // CSV: return first N lines
    const lines = text.split("\n");
    return lines.slice(0, maxRows + 1).join("\n");
  } catch {
    return "Impossible de télécharger cette ressource (timeout ou erreur réseau).";
  }
}

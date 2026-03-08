import { getAnthropicClient } from "@/lib/claude/client";

/**
 * Uses Claude API with MCP data.gouv.fr to search and download court decisions.
 *
 * The MCP server exposes tools:
 * - search_datasets: Search datasets by keywords
 * - get_dataset_info: Get metadata for a dataset
 * - list_dataset_resources: List files in a dataset
 * - query_resource_data: Filter data in a resource
 * - download_and_parse_resource: Download and parse a resource
 * - get_metrics: Usage metrics for a dataset
 */

export interface DatagouvSearchResult {
  datasets: Array<{
    id: string;
    title: string;
    description: string;
    nb_resources: number;
    last_update: string;
  }>;
}

export interface DatagouvResource {
  id: string;
  title: string;
  format: string;
  url: string;
  filesize: number;
  last_modified: string;
}

export async function searchDecisionsDatagouv(query: string): Promise<string> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Recherche sur data.gouv.fr les jeux de données correspondant à : "${query}".

Utilise l'outil search_datasets pour trouver les datasets pertinents.
Pour chaque dataset trouvé, utilise list_dataset_resources pour lister les ressources disponibles.

Retourne un résumé structuré en JSON avec cette forme :
{
  "datasets": [
    {
      "id": "...",
      "title": "...",
      "description": "...",
      "resources": [
        {
          "id": "...",
          "title": "...",
          "format": "...",
          "url": "..."
        }
      ]
    }
  ]
}`,
      },
    ],
    // MCP server integration via Claude API
    // Note: This requires the MCP server to be configured
    // In development, use `claude mcp add --transport http datagouv https://mcp.data.gouv.fr/mcp`
    // In production, use the mcp_servers parameter
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => {
      if (block.type === "text") return block.text;
      return "";
    })
    .join("");

  return text;
}

export async function importDecisionFromDatagouv(
  resourceId: string,
  query: string
): Promise<string> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Télécharge et parse la ressource ${resourceId} depuis data.gouv.fr.
Filtre les résultats pour ne garder que les décisions en droit du travail
portant sur "${query}".

Utilise download_and_parse_resource pour récupérer les données.

Retourne le texte brut des décisions trouvées, séparé par "---".`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => {
      if (block.type === "text") return block.text;
      return "";
    })
    .join("");

  return text;
}

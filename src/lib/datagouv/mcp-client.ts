/**
 * MCP data.gouv.fr client — calls the official MCP server via HTTP/SSE
 * Endpoint: https://mcp.data.gouv.fr/mcp
 *
 * Used as a complementary data source for statistical datasets
 * (not a replacement for Judilibre which has actual court decisions).
 */

const MCP_URL = "https://mcp.data.gouv.fr/mcp";

interface McpResult {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}

async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`MCP call failed: ${res.status}`);
  }

  const text = await res.text();
  // Parse SSE response — extract JSON from "data:" line
  const dataLine = text
    .split("\n")
    .find((line) => line.startsWith("data:"));
  if (!dataLine) {
    throw new Error("No data in MCP response");
  }

  const json = JSON.parse(dataLine.slice(5));
  const result = json.result as McpResult;

  if (result.isError) {
    throw new Error("MCP tool returned error");
  }

  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/**
 * Search for datasets on data.gouv.fr via MCP
 */
export async function searchDatasetsMcp(
  query: string,
  pageSize = 5
): Promise<string> {
  return callMcpTool("search_datasets", { query, page_size: pageSize });
}

/**
 * Query tabular data from a resource via MCP
 */
export async function queryResourceData(
  resourceId: string,
  question: string,
  pageSize = 20,
  filterColumn?: string,
  filterValue?: string
): Promise<string> {
  const args: Record<string, unknown> = {
    resource_id: resourceId,
    question,
    page_size: pageSize,
  };
  if (filterColumn) args.filter_column = filterColumn;
  if (filterValue) args.filter_value = filterValue;

  return callMcpTool("query_resource_data", args);
}

/**
 * Search for justice-related datasets and return formatted context
 * for injection into Claude analysis.
 */
export async function searchJusticeDatasets(
  topic: string
): Promise<string> {
  // Extract key legal terms
  const keywords = topic
    .toLowerCase()
    .replace(/[^a-zàâäéèêëïîôùûüÿç\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(" ");

  const searchTerms = keywords || topic.slice(0, 50);

  try {
    const result = await searchDatasetsMcp(searchTerms, 5);

    if (
      result.includes("No datasets found") ||
      result.trim().length < 20
    ) {
      return "";
    }

    return `═══ DATASETS DATA.GOUV.FR ═══\n${result}`;
  } catch {
    return "";
  }
}

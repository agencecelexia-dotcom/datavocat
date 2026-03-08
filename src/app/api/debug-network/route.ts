export const maxDuration = 15;

export async function GET() {
  const results: Record<string, string> = {};
  const urls = [
    "https://oauth.aife.economie.gouv.fr",
    "https://sandbox-oauth.aife.economie.gouv.fr",
    "https://api.piste.gouv.fr",
    "https://sandbox-api.piste.gouv.fr",
    "https://www.data.gouv.fr/api/1/datasets/?q=test&page_size=1",
    "https://mcp.data.gouv.fr/mcp",
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        method: url.includes("mcp") ? "POST" : "GET",
        headers: url.includes("mcp")
          ? { "Accept": "application/json, text/event-stream", "Content-Type": "application/json" }
          : {},
        body: url.includes("mcp")
          ? JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
          : undefined,
      });
      results[url] = `${r.status} ${r.statusText}`;
    } catch (e) {
      results[url] = e instanceof Error ? e.message : String(e);
    }
  }

  return Response.json(results);
}

import { NextRequest } from "next/server";

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {};

  // Check env vars
  results.envVars = {
    PISTE_CLIENT_ID: !!process.env.PISTE_CLIENT_ID,
    PISTE_CLIENT_SECRET: !!process.env.PISTE_CLIENT_SECRET,
    PISTE_KEY_ID: !!process.env.PISTE_KEY_ID,
    PISTE_SANDBOX: process.env.PISTE_SANDBOX,
  };

  const isSandbox = process.env.PISTE_SANDBOX === "true";
  const tokenUrl = isSandbox
    ? "https://sandbox-oauth.aife.economie.gouv.fr/api/oauth/token"
    : "https://oauth.aife.economie.gouv.fr/api/oauth/token";
  const baseUrl = isSandbox
    ? "https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0"
    : "https://api.piste.gouv.fr/cassation/judilibre/v1.0";

  results.urls = { tokenUrl, baseUrl, isSandbox };

  // Step 1: Try to get OAuth token
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.PISTE_CLIENT_ID || "",
        client_secret: process.env.PISTE_CLIENT_SECRET || "",
        scope: "openid",
      }),
    });

    results.tokenStatus = tokenRes.status;
    const tokenBody = await tokenRes.text();

    if (tokenRes.ok) {
      const tokenData = JSON.parse(tokenBody);
      results.tokenOk = true;
      results.tokenExpiresIn = tokenData.expires_in;

      // Step 2: Try search
      const headers: Record<string, string> = {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      };
      if (process.env.PISTE_KEY_ID) {
        headers["KeyId"] = process.env.PISTE_KEY_ID;
      }

      try {
        const searchRes = await fetch(
          `${baseUrl}/search?query=bail+commercial&operator=or&sort=score&order=desc&page_size=3`,
          { headers }
        );
        results.searchStatus = searchRes.status;
        const searchBody = await searchRes.text();

        if (searchRes.ok) {
          const data = JSON.parse(searchBody);
          results.searchOk = true;
          results.totalResults = data.total;
          results.resultsCount = data.results?.length;
          results.firstResult = data.results?.[0]
            ? {
                ecli: data.results[0].ecli,
                date: data.results[0].date,
                solution: data.results[0].solution,
              }
            : null;
        } else {
          results.searchError = searchBody.slice(0, 500);
        }
      } catch (searchErr) {
        results.searchError =
          searchErr instanceof Error ? searchErr.message : String(searchErr);
      }
    } else {
      results.tokenOk = false;
      results.tokenError = tokenBody.slice(0, 500);
    }
  } catch (err) {
    results.tokenError =
      err instanceof Error
        ? { message: err.message, cause: String(err.cause) }
        : String(err);
  }

  return Response.json(results, { status: 200 });
}

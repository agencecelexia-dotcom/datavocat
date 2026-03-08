import { NextRequest, NextResponse } from "next/server";
import { searchDecisionsDatagouv } from "@/lib/datagouv/client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query } = body;

  if (!query) {
    return NextResponse.json(
      { error: "Paramètre 'query' requis" },
      { status: 400 }
    );
  }

  try {
    const result = await searchDecisionsDatagouv(query);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

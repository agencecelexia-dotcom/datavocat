import { NextRequest, NextResponse } from "next/server";
import { extractDecisionFromPdf } from "@/lib/extraction/service";

async function handler(request: NextRequest) {
  const body = await request.json();
  const { decision_id, pdf_path } = body;

  if (!decision_id || !pdf_path) {
    return NextResponse.json(
      { error: "decision_id et pdf_path requis" },
      { status: 400 }
    );
  }

  console.log(`Processing extraction for decision ${decision_id}`);

  const result = await extractDecisionFromPdf(decision_id, pdf_path);

  if (result.success) {
    console.log(`Extraction successful for decision ${decision_id}`);
    return NextResponse.json({ status: "success", decision_id });
  } else {
    console.error(
      `Extraction failed for decision ${decision_id}: ${result.error}`
    );
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // In production, verify QStash signature
  if (
    process.env.NODE_ENV === "production" &&
    process.env.QSTASH_CURRENT_SIGNING_KEY
  ) {
    const { verifySignatureAppRouter } = await import(
      "@upstash/qstash/nextjs"
    );
    return verifySignatureAppRouter(handler)(request);
  }

  // In development, skip signature verification
  return handler(request);
}

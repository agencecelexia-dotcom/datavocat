import { getAnthropicClient } from "@/lib/claude/client";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_MESSAGE,
} from "@/lib/claude/extraction-prompt";
import { extractionSchema } from "@/lib/validators/decision";
import { createAdminClient } from "@/lib/supabase/admin";

export async function extractDecisionFromPdf(
  decisionId: string,
  pdfPath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // 1. Update status to 'extracting'
    await supabase
      .from("decisions")
      .update({ status: "extracting" })
      .eq("id", decisionId);

    // 2. Download PDF from Supabase Storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("decisions-pdfs")
      .download(pdfPath);

    if (downloadError || !pdfData) {
      throw new Error(`Erreur téléchargement PDF: ${downloadError?.message}`);
    }

    // 3. Convert to base64
    const arrayBuffer = await pdfData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // 4. Call Claude API with PDF
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_USER_MESSAGE,
            },
          ],
        },
      ],
    });

    // 5. Parse response
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("");

    const cleanedText = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    // 6. Validate with Zod
    const result = extractionSchema.parse(parsed);

    // 7. Update decision in database
    const { confidence_globale, alertes, ...decisionFields } = result;

    await supabase
      .from("decisions")
      .update({
        ...decisionFields,
        extraction_confidence: confidence_globale,
        status: "review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", decisionId);

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue";

    // Update status to 'error'
    await supabase
      .from("decisions")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", decisionId);

    console.error(`Extraction failed for decision ${decisionId}:`, message);
    return { success: false, error: message };
  }
}

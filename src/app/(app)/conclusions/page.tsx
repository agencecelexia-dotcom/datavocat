"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const JURIDICTIONS = [
  "Tribunal judiciaire",
  "Conseil de prud'hommes",
  "Cour d'appel",
  "Tribunal de commerce",
  "Tribunal administratif",
];

const QUALITES = [
  { value: "demandeur", label: "Demandeur" },
  { value: "defendeur", label: "Defendeur" },
  { value: "appelant", label: "Appelant" },
  { value: "intime", label: "Intime" },
  { value: "requerant", label: "Requerant" },
];

function formatMarkdown(text: string): string {
  // 1. Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Apply markdown formatting
  // ## headings
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-lg font-bold mt-6 mb-2 font-serif text-[#1e3a5f]">$1</h2>'
  );
  // ### subheadings
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-base font-semibold mt-4 mb-1 font-serif text-[#1e3a5f]">$1</h3>'
  );
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // - lists
  html = html.replace(
    /^- (.+)$/gm,
    '<li class="ml-6 list-disc text-sm">$1</li>'
  );
  // ECLI references — make clickable
  html = html.replace(
    /ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+/g,
    (match) =>
      `<a href="https://www.legifrance.gouv.fr/search?query=${encodeURIComponent(match)}" target="_blank" rel="noopener noreferrer" class="text-[#c9a96e] underline hover:text-[#1e3a5f]">${match}</a>`
  );
  // Line breaks
  html = html.replace(/\n\n/g, "<br/><br/>");
  html = html.replace(/\n/g, "<br/>");

  return html;
}

function formatForExport(text: string): string {
  return text
    .replace(
      /^CONCLUSIONS (.+)$/gm,
      "<h1>CONCLUSIONS $1</h1>"
    )
    .replace(
      /^(I{1,3}V?\.?\s+.+)$/gm,
      "<h2>$1</h2>"
    )
    .replace(
      /^([A-Z]\)\s+.+)$/gm,
      "<h3>$1</h3>"
    )
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

export default function ConclusionsPage() {
  const [juridiction, setJuridiction] = useState("");
  const [qualite, setQualite] = useState("");
  const [client, setClient] = useState("");
  const [adversaire, setAdversaire] = useState("");
  const [faits, setFaits] = useState("");
  const [args, setArgs] = useState("");
  const [demandes, setDemandes] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canSubmit =
    juridiction && qualite && client && adversaire && faits && demandes;

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/conclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          juridiction,
          qualite,
          client,
          adversaire,
          faits,
          arguments: args,
          demandes,
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de la generation");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setResult(text);
        }
      }
    } catch (error) {
      console.error(error);
      setResult(
        "Une erreur est survenue lors de la generation des conclusions."
      );
    } finally {
      setLoading(false);
    }
  }, [canSubmit, juridiction, qualite, client, adversaire, faits, args, demandes]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleExportDocx = useCallback(async () => {
    if (!result) return;

    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: result }),
      });

      if (!res.ok) {
        // Fallback: generate a .doc file client-side
        const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.6;margin:2cm;}
h1{font-size:14pt;text-align:center;font-weight:bold;}
h2{font-size:13pt;font-weight:bold;margin-top:1em;}
h3{font-size:12pt;font-weight:bold;margin-top:0.8em;}</style>
</head><body>${formatForExport(result)}</body></html>`;
        const blob = new Blob([htmlContent], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `conclusions_${client.replace(/\s+/g, "_")}.doc`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusions_${client.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: generate a .doc file client-side
      const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.6;margin:2cm;}
h1{font-size:14pt;text-align:center;font-weight:bold;}
h2{font-size:13pt;font-weight:bold;margin-top:1em;}
h3{font-size:12pt;font-weight:bold;margin-top:0.8em;}</style>
</head><body>${formatForExport(result)}</body></html>`;
      const blob = new Blob([htmlContent], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusions_${client.replace(/\s+/g, "_")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [result, client]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1e3a5f]">
          Generateur de conclusions
        </h1>
        <p className="mt-1 text-muted-foreground">
          Generez un projet de conclusions juridiques a partir de vos elements
          de fait et de droit
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-[#1e3a5f]">
            Elements de l&apos;affaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row: Juridiction + Qualite */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
                Juridiction
              </label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={juridiction}
                onChange={(e) => setJuridiction(e.target.value)}
              >
                <option value="">Selectionnez...</option>
                {JURIDICTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
                Qualite
              </label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={qualite}
                onChange={(e) => setQualite(e.target.value)}
              >
                <option value="">Selectionnez...</option>
                {QUALITES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Client + Adversaire */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
                Nom du client
              </label>
              <Input
                placeholder="Nom du client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
                Nom de l&apos;adversaire
              </label>
              <Input
                placeholder="Nom de la partie adverse"
                value={adversaire}
                onChange={(e) => setAdversaire(e.target.value)}
              />
            </div>
          </div>

          {/* Faits et procedure */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
              Faits et procedure
            </label>
            <Textarea
              className="min-h-[120px]"
              placeholder="Exposez les faits de maniere chronologique et la procedure engagee..."
              value={faits}
              onChange={(e) => setFaits(e.target.value)}
            />
          </div>

          {/* Arguments juridiques */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
              Arguments juridiques
            </label>
            <Textarea
              className="min-h-[100px]"
              placeholder="Listez les arguments juridiques principaux..."
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
          </div>

          {/* Demandes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1e3a5f]">
              Demandes
            </label>
            <Textarea
              className="min-h-[80px]"
              placeholder="Que demande votre client ? (indemnites, annulation, dommages-interets...)"
              value={demandes}
              onChange={(e) => setDemandes(e.target.value)}
            />
          </div>

          {/* Generate button */}
          <div className="flex justify-center pt-2">
            <Button
              onClick={handleGenerate}
              disabled={loading || !canSubmit}
              className="bg-[#1e3a5f] px-8 py-3 font-serif text-base font-semibold text-white hover:bg-[#2a4d7a]"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generation des conclusions en cours...
                </span>
              ) : (
                "Generer les conclusions"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && !result && (
        <div className="flex items-center justify-center gap-3 py-8 text-[#1e3a5f]">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="font-serif text-sm">
            Generation des conclusions en cours...
          </span>
        </div>
      )}

      {/* Results */}
      {result && (
        <Card className="border-t-4 border-t-[#c9a96e]">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl text-[#1e3a5f]">
              Projet de conclusions
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-[#c9a96e] text-[#c9a96e] hover:bg-[#c9a96e]/10"
              >
                {copied ? "Copie !" : "Copier"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDocx}
                className="border-[#c9a96e] text-[#c9a96e] hover:bg-[#c9a96e]/10"
              >
                Telecharger DOCX
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none font-serif dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(result),
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

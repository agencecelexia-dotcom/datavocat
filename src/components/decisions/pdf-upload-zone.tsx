"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "extracting" | "done" | "error";

export function PdfUploadZone() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const router = useRouter();

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf")) {
        setError("Seuls les fichiers PDF sont acceptés.");
        return;
      }

      setStatus("uploading");
      setFileName(file.name);
      setProgress(10);
      setError(null);

      try {
        // 1. Create decision entry
        setProgress(20);
        const res = await fetch("/api/decisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "upload",
            source_ref: file.name,
          }),
        });

        if (!res.ok) {
          throw new Error("Erreur création de la décision");
        }

        const decision = await res.json();
        setDecisionId(decision.id);
        setProgress(40);

        // 2. Upload PDF via API
        const pdfPath = `${decision.cabinet_id}/${decision.id}.pdf`;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", pdfPath);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json();
          throw new Error(`Erreur upload: ${uploadErr.error}`);
        }

        // Update decision with pdf_path
        await fetch(`/api/decisions/${decision.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdf_path: pdfPath }),
        });

        setProgress(60);
        setStatus("extracting");

        // 3. Trigger extraction
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision_id: decision.id,
            pdf_path: pdfPath,
          }),
        });

        if (!extractRes.ok) {
          throw new Error("Erreur déclenchement extraction");
        }

        setProgress(80);

        // 4. Poll for completion
        const pollInterval = setInterval(async () => {
          const pollRes = await fetch(`/api/decisions/${decision.id}`);
          const pollData = await pollRes.json();

          if (pollData.status === "review" || pollData.status === "validated") {
            clearInterval(pollInterval);
            setProgress(100);
            setStatus("done");
            setTimeout(() => {
              router.push(`/decisions/${decision.id}`);
            }, 1500);
          } else if (pollData.status === "error") {
            clearInterval(pollInterval);
            setStatus("error");
            setError("L'extraction a échoué. Veuillez réessayer.");
          }
        }, 3000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (status === "extracting") {
            setStatus("error");
            setError("Timeout — l'extraction prend trop de temps.");
          }
        }, 300000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    },
    [router, status]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  return (
    <Card>
      <CardContent className="p-6">
        {status === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 transition-colors hover:border-muted-foreground/50"
          >
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">
              Glissez-déposez un PDF ici
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              ou cliquez pour sélectionner un fichier
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            <Button variant="outline" type="button" onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
              Sélectionner un PDF
            </Button>
          </div>
        )}

        {(status === "uploading" || status === "extracting") && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {status === "uploading"
                    ? "Upload en cours..."
                    : "Extraction IA en cours (~30 secondes)..."}
                </p>
              </div>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium">Extraction terminée</p>
              <p className="text-sm text-muted-foreground">
                Redirection vers la revue des extractions...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium">Erreur</p>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
            <Button onClick={() => setStatus("idle")} variant="outline">
              Réessayer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

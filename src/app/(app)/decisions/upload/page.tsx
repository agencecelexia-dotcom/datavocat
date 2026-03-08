import { PdfUploadZone } from "@/components/decisions/pdf-upload-zone";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Upload d&apos;une décision
        </h1>
        <p className="text-muted-foreground">
          Uploadez un PDF de décision de justice. L&apos;IA extraira
          automatiquement les 39 champs structurés de la grille ACTA&apos;IA.
        </p>
      </div>
      <PdfUploadZone />
    </div>
  );
}

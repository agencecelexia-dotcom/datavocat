import { PdfUploadZone } from "@/components/decisions/pdf-upload-zone";
import { FileText, Cpu, CheckCircle2 } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Upload d&apos;une decision
        </h1>
        <p className="mt-1 text-muted-foreground">
          Uploadez un PDF de decision de justice. L&apos;IA extraira
          automatiquement les 39 champs structures de la grille ACTA&apos;IA.
        </p>
      </div>

      <PdfUploadZone />

      {/* Process steps */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: FileText, title: "Upload", desc: "Déposez votre PDF" },
          { icon: Cpu, title: "Extraction IA", desc: "39 champs analysés" },
          { icon: CheckCircle2, title: "Validation", desc: "Vérifiez et validez" },
        ].map((step, i) => (
          <div key={i} className="flex flex-col items-center rounded-xl border border-border/30 bg-card p-4 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/5">
              <step.icon className="h-5 w-5 text-[#1e3a5f]/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

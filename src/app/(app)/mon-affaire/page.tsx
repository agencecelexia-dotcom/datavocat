"use client";

import { useState, useRef, useCallback } from "react";
import { CaseForm } from "@/components/mon-affaire/case-form";
import { ProbabilityDashboard } from "@/components/mon-affaire/probability-dashboard";
import { Button } from "@/components/ui/button";
import type { MonAffaireInput } from "@/lib/validators/decision";
import type { ScoreAffaireSimilaire } from "@/types/stats";
import { formatMarkdownSafe } from "@/lib/format-markdown";

export default function MonAffairePage() {
  const [result, setResult] = useState<ScoreAffaireSimilaire | null>(null);
  const [params, setParams] = useState<MonAffaireInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  const handleModifyParams = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = async (data: MonAffaireInput) => {
    setLoading(true);
    setResult(null);
    setReport(null);
    setParams(data);

    try {
      const res = await fetch("/api/mon-affaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const score = await res.json();
        setResult(score);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = useCallback(() => {
    if (params) {
      setFormKey((k) => k + 1);
      handleSubmit(params);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleGenerateReport = async () => {
    if (!result || !params) return;
    setReportLoading(true);
    setReport("");

    try {
      const motifs = [];
      if (params.motif_opa) motifs.push("OPA");
      if (params.motif_ops) motifs.push("OPS");
      if (params.motif_opd) motifs.push("OPD");
      if (params.motif_defaut_qualite_signataires)
        motifs.push("Défaut qualité signataires");
      if (params.motif_vices_consentement) motifs.push("Vices du consentement");
      if (params.motif_objet_illicite) motifs.push("Objet illicite");
      if (params.motif_contrepartie_illusoire)
        motifs.push("Contrepartie illusoire");

      const res = await fetch("/api/rapport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: {
            taux_annulation: result.taux_annulation,
            total_similaires: result.total_similaires,
            taux_recevabilite: result.taux_recevabilite,
            delai_moyen: result.delai_moyen,
            montant_moyen: result.montant_moyen,
            decisions_proches: result.decisions_proches || [],
          },
          parametres: {
            juridiction_type: params.juridiction_type,
            perimetre_conclusion: params.perimetre_conclusion,
            demandeur_type: params.demandeur_type,
            bloc_negociation: params.bloc_negociation,
            motifs,
            post_ordonnance_2017: params.post_ordonnance_2017,
          },
        }),
      });

      if (!res.ok) throw new Error("Erreur génération rapport");

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setReport(text);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon Affaire</h1>
        <p className="text-muted-foreground">
          Entrez les paramètres de votre affaire pour obtenir une analyse
          probabiliste basée sur les décisions similaires.
        </p>
      </div>

      <div ref={formRef}>
        <CaseForm
          key={formKey}
          onSubmit={handleSubmit}
          loading={loading}
          initialValues={params || undefined}
        />
      </div>

      {result && (
        <>
          <ProbabilityDashboard
            result={result}
            onGenerateReport={handleGenerateReport}
            reportLoading={reportLoading}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleModifyParams}
              className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/10"
            >
              Modifier les parametres
            </Button>
            <Button
              onClick={handleReanalyze}
              disabled={loading}
              className="bg-[#c9a96e] text-white hover:bg-[#b8944f]"
            >
              {loading ? "Analyse en cours..." : "Relancer l'analyse"}
            </Button>
          </div>
        </>
      )}

      {report && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold">Rapport stratégique</h2>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: formatMarkdownSafe(report) }}
          />
        </div>
      )}
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ExternalLink, Copy, Check } from "lucide-react";
import Link from "next/link";

interface DecisionDetail {
  id: string;
  jurisdiction: string;
  chamber: string;
  number: string[];
  ecli: string;
  date: string;
  solution: string;
  solution_alt?: string;
  themes?: string[];
  sommaire?: string;
  text?: string;
  visa?: string[];
  rapprochements?: string[];
  titrage?: string[];
}

const CHAMBERS: Record<string, string> = {
  soc: "Chambre sociale",
  civ1: "1ère chambre civile",
  civ2: "2ème chambre civile",
  civ3: "3ème chambre civile",
  com: "Chambre commerciale",
  crim: "Chambre criminelle",
  mi: "Chambre mixte",
  pl: "Assemblée plénière",
};

export default function DecisionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [decision, setDecision] = useState<DecisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/veille/decision?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDecision(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });
  }, [id]);

  const handleCopy = () => {
    if (!decision?.text) return;
    navigator.clipboard.writeText(decision.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Link href="/veille" className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:text-[#c9a96e]">
          <ArrowLeft className="h-4 w-4" />
          Retour à la veille
        </Link>
        <div className="rounded-lg border border-[#9b2226]/20 bg-[#9b2226]/5 px-4 py-3 text-sm text-[#9b2226]">
          {error || "Décision introuvable"}
        </div>
      </div>
    );
  }

  const chamberName = CHAMBERS[decision.chamber] || decision.chamber;
  const jurisdictionName = decision.jurisdiction === "cc" ? "Cour de cassation" : `Cour d'appel (${decision.jurisdiction})`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Back link */}
      <Link href="/veille" className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] transition-colors hover:text-[#c9a96e]">
        <ArrowLeft className="h-4 w-4" />
        Retour à la veille
      </Link>

      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#1e3a5f]">
          {jurisdictionName}, {chamberName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {new Date(decision.date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Metadata card */}
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {/* ECLI */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#1e3a5f]">ECLI :</span>
            <code className="rounded bg-muted px-2 py-0.5 text-sm">{decision.ecli}</code>
            <a
              href={`https://www.courdecassation.fr/decision/${encodeURIComponent(decision.ecli)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c9a96e] hover:text-[#1e3a5f]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Pourvoi numbers */}
          {decision.number && decision.number.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#1e3a5f]">Pourvoi(s) :</span>
              <span className="text-sm">{decision.number.join(", ")}</span>
            </div>
          )}

          {/* Solution */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#1e3a5f]">Solution :</span>
            <Badge
              className={
                decision.solution.toLowerCase().includes("rejet")
                  ? "bg-[#2d6a4f]/10 text-[#2d6a4f] border-[#2d6a4f]/20"
                  : decision.solution.toLowerCase().includes("cassation")
                  ? "bg-[#9b2226]/10 text-[#9b2226] border-[#9b2226]/20"
                  : ""
              }
            >
              {decision.solution_alt || decision.solution}
            </Badge>
          </div>

          {/* Themes */}
          {decision.themes && decision.themes.length > 0 && (
            <div>
              <span className="text-sm font-medium text-[#1e3a5f]">Thèmes :</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-[#1e3a5f]/5 px-2 py-0.5 text-xs text-[#1e3a5f]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Visa */}
          {decision.visa && decision.visa.length > 0 && (
            <div>
              <span className="text-sm font-medium text-[#1e3a5f]">Visa :</span>
              <ul className="mt-1 ml-4 list-disc text-sm text-muted-foreground">
                {decision.visa.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sommaire */}
      {decision.sommaire && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-[#1e3a5f]">Sommaire</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {decision.sommaire}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Full text */}
      {decision.text && (
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-[#1e3a5f]">Texte intégral</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="cursor-pointer border-[#c9a96e]/40 text-[#c9a96e] hover:bg-[#c9a96e]/10"
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copier
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto rounded-lg bg-muted/30 p-6">
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">
                {decision.text}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rapprochements */}
      {decision.rapprochements && decision.rapprochements.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-[#1e3a5f]">Rapprochements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {decision.rapprochements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Database,
} from "lucide-react";

type Etat = "ok" | "ko" | "desactive" | "non_configure";

interface SourceStatus {
  cle: string;
  nom: string;
  couverture: string;
  etat: Etat;
  detail: string;
  optionnelle: boolean;
}

interface SourcesData {
  verifieLe: string;
  analyseExploitable: boolean;
  sources: SourceStatus[];
}

const ETATS: Record<
  Etat,
  { label: string; couleur: string; Icone: typeof CheckCircle2 }
> = {
  ok: { label: "Opérationnelle", couleur: "var(--emerald, #2d6a4f)", Icone: CheckCircle2 },
  ko: { label: "En échec", couleur: "var(--bordeaux, #9b2226)", Icone: XCircle },
  desactive: { label: "Désactivée", couleur: "var(--muted-foreground)", Icone: MinusCircle },
  non_configure: { label: "Non configurée", couleur: "var(--amber, #ca6702)", Icone: AlertTriangle },
};

export default function SourcesPage() {
  const [data, setData] = useState<SourcesData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sources");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      toast.error("Impossible de vérifier les sources");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
      <div className="flex items-center gap-3 mb-6">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: "var(--gold)" }}
        >
          § Administration
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      <div className="flex items-start justify-between gap-4 mb-3">
        <h1 className="font-serif text-[36px] font-medium tracking-tight">
          Sources de <span className="dv-italic">données.</span>
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] transition-colors disabled:opacity-50"
          style={{ border: "1px solid var(--line)", background: "var(--card)" }}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Re-tester
        </button>
      </div>

      <p className="text-[14px] mb-8" style={{ color: "var(--muted-foreground)" }}>
        Interrogation en direct de chaque base jurisprudentielle. Ce test appelle
        réellement les API depuis le serveur de production.
      </p>

      {loading && !data && (
        <div className="flex items-center gap-3 py-16 justify-center" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Test des sources en cours…</span>
        </div>
      )}

      {data && (
        <>
          <div
            className="p-5 rounded-md mb-6 flex items-start gap-3"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
              borderLeft: `3px solid ${
                data.analyseExploitable
                  ? "var(--emerald, #2d6a4f)"
                  : "var(--bordeaux, #9b2226)"
              }`,
            }}
          >
            <Database className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--ink)" }} />
            <div>
              <div className="font-serif text-[17px] font-medium mb-1">
                {data.analyseExploitable
                  ? "Les analyses sont exploitables."
                  : "Les analyses sont compromises."}
              </div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {data.analyseExploitable
                  ? "La source principale répond. Une source optionnelle en échec réduit la couverture — CEDH, CJUE ou contentieux administratif — mais ne fausse aucune statistique : l'analyse se poursuit sans elle."
                  : "Judilibre ne répond pas. C'est la source principale des statistiques : sans elle, aucune analyse jurimétrique fiable n'est possible."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.sources.map((s) => {
              const e = ETATS[s.etat];
              const Icone = e.Icone;
              return (
                <div
                  key={s.cle}
                  className="p-5 rounded-md"
                  style={{ border: "1px solid var(--line)", background: "var(--card)" }}
                >
                  <div className="flex items-start gap-3">
                    <Icone className="h-4 w-4 mt-1 shrink-0" style={{ color: e.couleur }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h2 className="font-serif text-[19px] font-medium tracking-tight">
                          {s.nom}
                        </h2>
                        <span
                          className="font-mono text-[9.5px] uppercase tracking-[0.18em] px-2 py-0.5 rounded"
                          style={{ color: e.couleur, border: `1px solid ${e.couleur}` }}
                        >
                          {e.label}
                        </span>
                        {!s.optionnelle && (
                          <span
                            className="font-mono text-[9.5px] uppercase tracking-[0.18em]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            source principale
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] mb-2" style={{ color: "var(--muted-foreground)" }}>
                        {s.couverture}
                      </p>
                      <p className="font-mono text-[11.5px] leading-relaxed break-words" style={{ color: "var(--ink)" }}>
                        {s.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 font-mono text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
            Vérifié le{" "}
            {new Date(data.verifieLe).toLocaleString("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </>
      )}
    </div>
  );
}

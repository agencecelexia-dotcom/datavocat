"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  FileDown,
  FileJson,
  Sheet,
  Search,
  Database,
  Brain,
  Table,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { parseAnalysisResponse, ParsedAnalysis } from "@/lib/parse-analysis";
import { TOUR_QUERY } from "@/hooks/use-product-tour";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { AnalysisChat } from "@/components/analysis/chat";
import { SourcesAnnex } from "@/components/analysis/sources-annex";
import { EvidenceTable } from "@/components/analysis/evidence-table";
import { formatMarkdownSafe } from "@/lib/format-markdown";
import { CopyMarkdown } from "@/components/ui/copy-markdown";

interface ClarifyQuestion {
  id: string;
  question: string;
  type: "text" | "choice";
  multiSelect?: boolean;
  choices?: string[];
}

type Phase = "input" | "clarify" | "analyzing" | "done";

interface AnalysisMeta {
  analyzedCount: number;
  totalFound: number;
  oldestDate: string | null;
  freshestDate: string | null;
}

type StreamStepKey = "judilibre" | "datagouv" | "claude";
type StreamStepState = "pending" | "active" | "done";
type StreamSteps = Record<StreamStepKey, StreamStepState>;

const DEFAULT_STREAM_STEPS: StreamSteps = {
  judilibre: "active",
  datagouv: "pending",
  claude: "pending",
};

const LAWYER_JOKES = [
  "Pourquoi les avocats ne vont jamais a la plage ? Parce qu'ils ont peur que les chats les prennent pour du sable mouvant.",
  "Quelle est la difference entre un avocat et un requin ? L'un est un predateur sans pitie, et l'autre est un poisson.",
  "Un avocat demande a son client : 'Avez-vous dit toute la verite ?' Le client repond : 'Non, je vous ai engage pour ca.'",
  "Comment appelle-t-on un avocat qui ne ment jamais ? Un debutant.",
  "Pourquoi les avocats portent-ils la robe ? Pour cacher leur jeu.",
  "Un juge demande a l'accuse : 'Pourquoi avez-vous vole cette voiture ?' L'accuse repond : 'Elle etait garee devant le palais de justice, j'ai cru que c'etait un service public.'",
  "Que fait un avocat quand il fait froid ? Il met un article supplementaire.",
  "Mon avocat m'a dit : 'J'ai une bonne et une mauvaise nouvelle.' La bonne : 'Votre femme a trouve une photo qui vaut 50 000 euros.' La mauvaise : 'C'est une photo de vous avec votre maitresse.'",
  "Pourquoi les avocats font-ils de mauvais magiciens ? Parce qu'ils ne font que des tours de passe-passe juridiques.",
  "Saviez-vous que 99% des avocats donnent une mauvaise image de la profession ? Le 100eme est en vacances.",
  "Un avocat dit a un autre : 'On fait un proces ?' L'autre repond : 'D'accord, mais c'est moi qui gagne !'",
  "La justice est aveugle. Heureusement, les avocats ont le nez creux.",
  "Comment reconnait-on un bon avocat ? Il connait la loi. Et un excellent avocat ? Il connait le juge.",
  "Pourquoi les avocats ne jouent-ils jamais a cache-cache ? Parce que personne ne les cherche.",
  "Quelle est la devise des avocats ? 'In Deus we trust, tous les autres paient comptant.'",
];

export default function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "text" | "dashboard" | "sources" | "tableau"
  >("text");
  const responseRef = useRef<HTMLDivElement>(null);

  // Clarification state
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  // Streaming metadata (transparence + étapes loader)
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);
  const [streamSteps, setStreamSteps] = useState<StreamSteps>(DEFAULT_STREAM_STEPS);

  const parsedData = useMemo(() => {
    if (!response || phase !== "done") return null;
    return parseAnalysisResponse(response);
  }, [response, phase]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Tour: listen for fill-query event from product tour
  useEffect(() => {
    const handler = () => {
      if (phase === "input") {
        setQuery(TOUR_QUERY);
      }
    };
    window.addEventListener("tour:fill-query", handler);
    return () => window.removeEventListener("tour:fill-query", handler);
  }, [phase]);

  // Step 1: Submit query -> get clarifying questions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setPhase("clarify");
    setQuestions([]);
    setAnswers({});

    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        await launchAnalysis(query.trim());
        return;
      }

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions.slice(0, 5));
        setLoading(false);
      } else {
        await launchAnalysis(query.trim());
      }
    } catch {
      await launchAnalysis(query.trim());
    }
  };

  const handleSubmitAnswers = async () => {
    const enrichedQuery = buildEnrichedQuery();
    await launchAnalysis(enrichedQuery);
  };

  const handleSkipClarification = async () => {
    await launchAnalysis(query.trim());
  };

  const buildEnrichedQuery = () => {
    let enriched = query.trim();
    const answeredQuestions = questions.filter((q) =>
      (answers[q.id] || []).some((v) => v.trim())
    );
    if (answeredQuestions.length > 0) {
      enriched += "\n\nPRECISIONS COMPLEMENTAIRES :";
      for (const q of answeredQuestions) {
        const values = (answers[q.id] || []).map((v) => v.trim()).filter(Boolean);
        enriched += `\n- ${q.question} -> ${values.join(" ; ")}`;
      }
    }
    return enriched;
  };

  const launchAnalysis = async (fullQuery: string) => {
    setLoading(true);
    setPhase("analyzing");
    setResponse("");
    setAnalysisId(null);
    setActiveView("text");
    setAnalysisMeta(null);
    setStreamSteps({ ...DEFAULT_STREAM_STEPS });
    const analysisStartedAt = Date.now();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: fullQuery }),
      });

      if (!res.ok) {
        setResponse("Erreur lors de l'analyse. Veuillez reessayer.");
        setPhase("done");
        setLoading(false);
        return;
      }

      const id = res.headers.get("X-Analysis-Id");
      if (id) setAnalysisId(id);

      // Métadonnées d'analyse (volumétrie + période)
      const analyzed = parseInt(res.headers.get("X-Decisions-Analyzed") || "0", 10);
      const totalFound = parseInt(res.headers.get("X-Decisions-Found") || "0", 10);
      const oldest = res.headers.get("X-Decisions-Oldest") || null;
      const freshest = res.headers.get("X-Decisions-Freshest") || null;
      setAnalysisMeta({ analyzedCount: analyzed, totalFound, oldestDate: oldest, freshestDate: freshest });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let cleanText = "";

      // Intercepte les lignes [STEP:...] pour piloter les étapes du loader.
      const stepPattern = /\[STEP:([^\]]+)\]/g;
      const applyStep = (raw: string) => {
        const parts = raw.split(":");
        const key = parts[0] as StreamStepKey;
        const state = parts[1];
        if (key === "judilibre" && state === "done") {
          setStreamSteps((s) => ({ ...s, judilibre: "done", datagouv: "active" }));
        } else if (key === "datagouv" && state === "done") {
          setStreamSteps((s) => ({ ...s, datagouv: "done", claude: "active" }));
        } else if (key === "claude" && state === "start") {
          setStreamSteps((s) => ({ ...s, claude: "active" }));
        } else if (key === "claude" && state === "done") {
          setStreamSteps((s) => ({ ...s, claude: "done" }));
        }
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Extraire les [STEP:] au fil de l'eau et garder le reste
          let match: RegExpExecArray | null;
          let lastIndex = 0;
          let stripped = "";
          stepPattern.lastIndex = 0;
          while ((match = stepPattern.exec(buffer)) !== null) {
            stripped += buffer.slice(lastIndex, match.index);
            applyStep(match[1]);
            lastIndex = match.index + match[0].length;
          }
          stripped += buffer.slice(lastIndex);

          // Conserve le texte propre progressif (sans les balises ni leurs newlines suivants)
          cleanText = stripped.replace(/\n\[STEP:[^\]]+\]\n?/g, "").replace(/^\[STEP:[^\]]+\]\n?/g, "");
          setResponse(cleanText);
        }
      }
    } catch {
      setResponse("Erreur de connexion. Vérifiez votre connexion internet.");
    } finally {
      recordAnalysisDuration(Date.now() - analysisStartedAt);
      setLoading(false);
      setPhase("done");
    }
  };

  const handleNewAnalysis = () => {
    setQuery("");
    setResponse("");
    setAnalysisId(null);
    setPhase("input");
    setQuestions([]);
    setAnswers({});
    setActiveView("text");
  };

  const setSingleAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value ? [value] : [] }));
  };

  const toggleMultiAnswer = (id: string, choice: string) => {
    setAnswers((prev) => {
      const current = prev[id] || [];
      const next = current.includes(choice)
        ? current.filter((v) => v !== choice)
        : [...current, choice];
      return { ...prev, [id]: next };
    });
  };

  const setFreeFormAnswer = (id: string, value: string, choices: string[]) => {
    setAnswers((prev) => {
      const current = prev[id] || [];
      // On conserve les choix pré-définis cochés et on remplace/ajoute la saisie libre.
      const kept = current.filter((v) => choices.includes(v));
      const next = value.trim() ? [...kept, value] : kept;
      return { ...prev, [id]: next };
    });
  };

  const handleExport = async (format: "pdf" | "docx" | "csv" | "json") => {
    if (!response) {
      toast.error("Aucune analyse à exporter");
      return;
    }
    const loadingId = toast.loading(`Préparation de l'export ${format.toUpperCase()}…`);
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          query,
          response,
          parsed: parsedData,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        toast.error(`Export ${format.toUpperCase()} impossible : ${errBody.error || res.statusText}`, { id: loadingId });
        console.error(`Export ${format} failed`, res.status, errBody);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datavocat-analyse.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé`, { id: loadingId });
    } catch (err) {
      toast.error(`Export ${format.toUpperCase()} indisponible. Réessayez plus tard.`, { id: loadingId });
      console.error(`Export ${format} threw`, err);
    }
  };

  const examples = [
    "Mon client est un salarie licencie pour faute grave apres 15 ans d'anciennete dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?",
    "Une OS non signataire veut contester un accord collectif sur le temps de travail dans une entreprise de 500 salaries. L'accord a ete signe par des syndicats representant 55% des votes. Quels arguments privilegier ?",
    "Mon client locataire d'un bail commercial a Paris se voit refuser le renouvellement par le bailleur. Le bail dure depuis 12 ans. Quelles indemnites d'eviction peut-il esperer ?",
  ];

  const answeredCount = questions.filter((q) =>
    (answers[q.id] || []).some((v) => v.trim())
  ).length;

  return (
    <div className="flex h-full flex-col" data-tour-phase={phase} data-tour-active-view={activeView} data-tour="tour-page">
      {phase === "input" ? (
        /* ═══ SAISINE — Hero éditorial Greffe ═══ */
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[780px] px-6 lg:px-10 py-16 lg:py-24">
            {/* Eyebrow */}
            <div className="mb-5 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold)" }}>
                  § Nouvelle analyse
                </span>
                <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              </div>
            </div>

            {/* Hero */}
            <div className="mb-10 animate-fade-in-up d-1">
              <h1 className="font-serif text-[44px] leading-[0.98] font-medium tracking-tight sm:text-[56px] lg:text-[68px]">
                Analysez{" "}
                <span className="dv-italic">votre affaire.</span>
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed max-w-[560px]" style={{ color: "var(--muted-foreground)" }}>
                Décrivez la situation juridique. L&apos;IA croise{" "}
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  562 487 décisions
                </span>{" "}
                de Judilibre et data.gouv.fr pour produire statistiques, recommandations et sources vérifiables.
              </p>
            </div>

            {/* Input card */}
            <form onSubmit={handleSubmit} className="animate-fade-in-up d-2">
              <div
                data-tour="query-input"
                className="relative overflow-hidden"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                }}
              >
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Mon client, salarié depuis 15 ans dans une entreprise de BTP, conteste un licenciement pour faute grave…"
                  className="min-h-[140px] w-full resize-none border-0 bg-transparent px-5 py-5 text-[15px] leading-[1.7] shadow-none ring-0 placeholder:text-[color:var(--muted-foreground)]/50 focus:border-0 focus:ring-0 focus-visible:ring-0 focus-visible:border-0"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit(e);
                    }
                  }}
                />
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: "1px solid var(--line-soft)" }}
                >
                  <div className="hidden sm:flex items-center gap-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    <kbd
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        border: "1px solid var(--line)",
                        background: "var(--paper)",
                      }}
                    >
                      ⌘↵
                    </kbd>
                    <span>pour lancer</span>
                  </div>
                  <button
                    data-tour="analyze-button"
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-semibold text-white transition-all disabled:opacity-40 cursor-pointer"
                    style={{ background: "var(--ink)" }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Analyser</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Examples */}
            <div data-tour="examples" className="mt-8 animate-fade-in-up d-3">
              <div className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>
                Exemples de saisine
              </div>
              <div className="space-y-2">
                {examples.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(example)}
                    className="group w-full text-left p-3.5 rounded-md transition-colors cursor-pointer"
                    style={{
                      border: "1px solid var(--line)",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--paper)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <p className="text-[13px] leading-[1.55]" style={{ color: "var(--ink)" }}>
                      {example}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Trust line */}
            <div
              className="mt-10 flex flex-wrap items-center gap-4 text-[11px] font-mono uppercase tracking-[0.15em] animate-fade-in-up d-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Judilibre + data.gouv.fr
              </span>
              <span className="h-3 w-px" style={{ background: "var(--line)" }} />
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Données chiffrées
              </span>
              <span className="h-3 w-px" style={{ background: "var(--line)" }} />
              <span className="flex items-center gap-1.5">
                <Brain className="h-3 w-3" />
                IA Claude Sonnet 4
              </span>
            </div>
          </div>
        </div>
      ) : phase === "clarify" && loading ? (
        /* ═══ Préparation des questions — loader minimal ═══ */
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[780px] px-6 lg:px-10 py-20">
            <div className="flex flex-col items-center text-center">
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 mb-6"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--gold)" }}
                />
                § Préparation des questions
              </div>
              <h2
                className="font-serif text-[36px] font-medium tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                L&apos;IA <span className="dv-italic">analyse</span> votre saisine.
              </h2>
              <p className="mt-3 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                Identification des zones d&apos;ambiguïté — quelques secondes.
              </p>
              <div
                className="mt-10 pl-4 max-w-xl w-full text-left"
                style={{ borderLeft: "2px solid var(--gold)" }}
              >
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Saisine
                </div>
                <p className="text-[14px] leading-[1.65]" style={{ color: "var(--ink)" }}>
                  {query}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : phase === "clarify" && !loading ? (
        /* ═══ Clarification — style éditorial Greffe ═══ */
        <div data-tour="clarify-section" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[780px] px-6 lg:px-10 py-14">
            {/* Saisine echo */}
            <div
              className="mb-10 pl-4"
              style={{ borderLeft: "2px solid var(--gold)" }}
            >
              <div
                className="font-mono text-[10px] uppercase tracking-[0.18em] mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Saisine
              </div>
              <p className="text-[14px] leading-[1.65]" style={{ color: "var(--ink)" }}>
                {query}
              </p>
            </div>

            {/* Heading */}
            <h2
              className="font-serif text-[36px] font-medium tracking-tight mb-3"
              style={{ color: "var(--ink)" }}
            >
              Quelques <span className="dv-italic">précisions.</span>
            </h2>
            <p
              className="text-[14.5px] mb-8 leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              L&apos;IA a identifié {questions.length} zone{questions.length > 1 ? "s" : ""} d&apos;ambiguïté. Chaque réponse affine la précision statistique.
            </p>

            {/* Progression bar */}
            <div className="mb-10">
              <div
                className="mb-1.5 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.15em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>Progression</span>
                <span className="tabular-nums">
                  {String(answeredCount).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
                </span>
              </div>
              <div
                className="h-[2px] w-full relative"
                style={{ background: "var(--line)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-500"
                  style={{
                    width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
                    background: "var(--gold)",
                  }}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-8">
              {questions.map((q, idx) => {
                const selected = answers[q.id] || [];
                const choices = q.choices || [];
                const freeFormValue = selected.find((v) => !choices.includes(v)) || "";
                const isMulti = q.multiSelect === true;
                return (
                  <div key={q.id}>
                    <div className="flex items-baseline gap-3 mb-3">
                      <span
                        className="font-mono text-[11px] tabular-nums shrink-0"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <label
                        className="text-[14.5px] font-medium leading-[1.5]"
                        style={{ color: "var(--ink)" }}
                      >
                        {q.question}
                        {q.type === "choice" && isMulti && (
                          <span
                            className="ml-2 text-[12px] font-normal italic"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            (plusieurs choix possibles)
                          </span>
                        )}
                      </label>
                    </div>
                    {q.type === "choice" && choices.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pl-7">
                        {choices.map((choice) => {
                          const isSelected = selected.includes(choice);
                          return (
                            <button
                              key={choice}
                              onClick={() =>
                                isMulti
                                  ? toggleMultiAnswer(q.id, choice)
                                  : setSingleAnswer(q.id, isSelected ? "" : choice)
                              }
                              className="px-3.5 py-1.5 text-[13px] rounded-full transition-colors cursor-pointer"
                              style={{
                                background: isSelected ? "var(--ink)" : "transparent",
                                color: isSelected ? "#fff" : "var(--muted-foreground)",
                                border: `1px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              {isSelected && isMulti && <span className="mr-1">✓</span>}
                              {choice}
                            </button>
                          );
                        })}
                        <input
                          placeholder="Autre…"
                          className="px-3.5 py-1.5 text-[13px] bg-transparent outline-none rounded-full"
                          style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
                          value={freeFormValue}
                          onChange={(e) =>
                            isMulti
                              ? setFreeFormAnswer(q.id, e.target.value, choices)
                              : setSingleAnswer(q.id, e.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <input
                        placeholder="Votre réponse…"
                        className="ml-7 px-0 py-1.5 text-[14px] bg-transparent outline-none w-[calc(100%-1.75rem)]"
                        style={{ borderBottom: "1px solid var(--line)", color: "var(--ink)" }}
                        value={selected[0] || ""}
                        onChange={(e) => setSingleAnswer(q.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div
              data-tour="clarify-buttons"
              className="mt-12 flex items-center justify-between pt-6"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <button
                onClick={handleSkipClarification}
                className="text-[13px] underline underline-offset-4 cursor-pointer"
                style={{
                  color: "var(--muted-foreground)",
                  textDecorationColor: "var(--line)",
                }}
              >
                Passer et analyser
              </button>
              <button
                onClick={handleSubmitAnswers}
                disabled={answeredCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-semibold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--ink)" }}
              >
                <span>Lancer l&apos;analyse</span>
                {answeredCount > 0 && (
                  <span className="font-mono text-[11px] tabular-nums opacity-70">
                    {answeredCount}/{questions.length}
                  </span>
                )}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : phase === "analyzing" ? (
        /* ═══ ANALYSE EN COURS ═══ */
        <div data-tour="analyzing-screen" className="flex-1">
          <AnalyzingScreen steps={streamSteps} meta={analysisMeta} />
        </div>
      ) : (
        /* ═══ RESULTS — rapport d'analyse éditorial ═══ */
        <div className="flex-1 overflow-y-auto" ref={responseRef}>
          <div className="mx-auto max-w-[1040px] px-6 lg:px-10 py-10">
            {/* Title block */}
            {parsedData && (
              <div className="mb-8">
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3 flex flex-wrap items-center gap-x-3 gap-y-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span style={{ color: "var(--gold)" }}>§ Rapport d&apos;analyse</span>
                  <span>·</span>
                  <span>
                    {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {analysisId && (
                    <>
                      <span>·</span>
                      <span>Dossier № {analysisId.slice(0, 8).toUpperCase()}</span>
                    </>
                  )}
                </div>
                <h1 className="font-serif text-[32px] sm:text-[40px] lg:text-[44px] leading-[1.05] font-medium tracking-tight">
                  <ResultsTitle query={query} />
                </h1>
              </div>
            )}

            {/* Headline stat + gauge */}
            {parsedData && (
              <div
                className="mb-10 pb-10"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center">
                  <div>
                    <div
                      className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Taux de succès estimé
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <div
                        className="font-serif font-medium tabular-nums"
                        style={{
                          fontSize: "88px",
                          color: "var(--ink)",
                          letterSpacing: "-0.02em",
                          lineHeight: 1,
                        }}
                      >
                        {parsedData.tauxSuccesGlobal ?? "—"}
                      </div>
                      <div
                        className="font-serif text-[32px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        %
                      </div>
                    </div>
                    <div
                      className="mt-3 text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Sur {parsedData.echantillon ?? analysisMeta?.analyzedCount ?? "—"} décisions analysées ·{" "}
                      {parsedData.sourceCount} sources citées
                      {analysisMeta?.freshestDate && ` · jusqu'au ${analysisMeta.freshestDate}`}
                    </div>
                  </div>
                  <div
                    className="lg:pl-10 lg:border-l"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <FiabiliteBar fiabilite={parsedData.fiabilite} />
                    <div
                      className="mt-3 text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Indice de fiabilité{" "}
                      <span
                        className="font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {parsedData.fiabilite.label.toLowerCase()}
                      </span>{" "}
                      — calculé sur la cohérence et l&apos;autorité des sources.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs + exports */}
            {parsedData && (
              <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                <div data-tour="tour-view-tabs" className="flex items-center gap-1">
                  {[
                    { key: "text" as const, label: "Rapport" },
                    { key: "dashboard" as const, label: "Chiffres" },
                    { key: "sources" as const, label: "Sources", count: parsedData.sourceCount },
                    { key: "tableau" as const, label: "Tableau" },
                  ].map((t) => {
                    const active = activeView === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setActiveView(t.key)}
                        className="px-3 py-1.5 text-[13px] transition-all cursor-pointer"
                        style={{
                          color: active ? "var(--ink)" : "var(--muted-foreground)",
                          fontWeight: active ? 500 : 400,
                          borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                        }}
                      >
                        {t.label}
                        {typeof t.count === "number" && (
                          <span className="ml-1" style={{ color: "var(--muted-foreground)" }}>
                            ({t.count})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div data-tour="tour-export-buttons" className="flex items-center gap-1.5">
                  <CopyMarkdown content={response} />
                  <ExportButton icon={FileDown} label="PDF" onClick={() => handleExport("pdf")} />
                  <ExportButton icon={FileDown} label="DOCX" onClick={() => handleExport("docx")} />
                  <ExportButton icon={Sheet} label="CSV" onClick={() => handleExport("csv")} title="Exporter le tableau de preuve en CSV" />
                  <ExportButton icon={FileJson} label="JSON" onClick={() => handleExport("json")} title="Exporter l'analyse complète en JSON" />
                </div>
              </div>
            )}

            {/* Content area */}
            {activeView === "text" && response && (
              <div className="animate-fade-in-up">
                <div
                  className="prose-legal max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdownSafe(response) }}
                />
              </div>
            )}

            {activeView === "dashboard" && parsedData && (
              <div className="animate-fade-in-up">
                <AnalysisDashboard data={parsedData} meta={analysisMeta} />
              </div>
            )}

            {activeView === "tableau" && parsedData && parsedData.evidenceTable && (
              <div className="animate-fade-in-up">
                <EvidenceTable data={parsedData.evidenceTable} />
              </div>
            )}
            {activeView === "tableau" && parsedData && !parsedData.evidenceTable && (
              <div className="flex items-center justify-center p-12 text-center">
                <div>
                  <Table className="mx-auto h-10 w-10 mb-3" style={{ color: "var(--muted-foreground)" }} />
                  <p className="text-[14px]" style={{ color: "var(--muted-foreground)" }}>
                    Aucun tableau de preuve disponible pour cette analyse.
                  </p>
                </div>
              </div>
            )}

            {activeView === "sources" && parsedData && (
              <div className="animate-fade-in-up">
                <SourcesAnnex data={parsedData} />
              </div>
            )}

            {/* Follow-up chat */}
            {phase === "done" && response && (
              <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
                <AnalysisChat analysisContext={response} query={query} />
              </div>
            )}

            {/* Suggestions + nouvelle analyse */}
            {phase === "done" && (
              <div
                className="mt-8 pt-6 flex flex-wrap items-center justify-between gap-4"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Approfondir
                  </span>
                  {[
                    "Et si on changeait de juridiction ?",
                    "Quels sont les risques en appel ?",
                    "Comment renforcer cet argument ?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        const enriched =
                          query.trim() + "\n\nQUESTION COMPLEMENTAIRE : " + suggestion;
                        launchAnalysis(enriched);
                      }}
                      className="px-3 py-1.5 text-[12px] rounded-full transition-colors cursor-pointer"
                      style={{
                        border: "1px solid var(--line)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNewAnalysis}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-medium rounded-md text-white cursor-pointer"
                  style={{ background: "var(--ink)" }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Nouvelle analyse
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Helpers Greffe ═══ */

function ExportButton({
  icon: Icon,
  label,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] rounded-md cursor-pointer transition-colors"
      style={{
        border: "1px solid var(--line)",
        color: "var(--muted-foreground)",
        background: "transparent",
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/**
 * Titre du rapport : retire une mention de juridiction de la query pour
 * l'italiciser en gold à la façon "Licenciement pour faute grave, *CPH de Paris*".
 */
function ResultsTitle({ query }: { query: string }) {
  const clean = query.trim();
  if (!clean) return <span>Analyse jurimétrique</span>;
  const trimmed = clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
  const juriRegex = /(CPH(?:\s+de)?\s+[A-Z][a-zà-ÿ]+|Cour\s+d['e]appel(?:\s+de)?\s+[A-Z][a-zà-ÿ]+|Tribunal\s+\w+\s+(?:de\s+)?[A-Z][a-zà-ÿ]+|Cour\s+de\s+cassation)/i;
  const match = trimmed.match(juriRegex);
  if (match && match.index !== undefined) {
    const before = trimmed.slice(0, match.index).replace(/[,.]?\s*$/, "");
    const after = trimmed.slice(match.index + match[0].length).replace(/^[,.]?\s*/, "");
    return (
      <>
        {before}
        {before && ", "}
        <span className="dv-italic">{match[0]}</span>
        {after && <>, {after}</>}
      </>
    );
  }
  return <span>{trimmed}</span>;
}

/**
 * Jauge fiabilité — barre segmentée (style Greffe, remplace le SVG 3D).
 */
function FiabiliteBar({ fiabilite }: { fiabilite: ParsedAnalysis["fiabilite"] }) {
  const score = fiabilite.score;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Indice de fiabilité
        </div>
        <div
          className="font-mono text-[22px] tabular-nums font-semibold"
          style={{ color: "var(--gold)" }}
        >
          {score}
          <span
            className="text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            /100
          </span>
        </div>
      </div>
      <div
        className="relative h-[8px] rounded-full overflow-hidden"
        style={{ background: "var(--paper-2)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bar-fill"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, var(--gold) 70%, transparent), var(--gold))`,
          }}
        />
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${t}%`, background: "rgba(255,255,255,0.4)" }}
          />
        ))}
      </div>
      <div
        className="flex justify-between mt-1.5 font-mono text-[9px] tabular-nums"
        style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
      >
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

/* ═══ ANALYZING SCREEN (lawyer jokes + steps réels + décompte dynamique) ═══ */

// Durée moyenne (ms) d'une analyse, calibrée par la moyenne des 5 dernières
// sessions réussies stockées dans localStorage (fallback 48 s).
const DEFAULT_ANALYSIS_MS = 48000;
const STORAGE_KEY_DURATIONS = "datavocat.analysis.durations";

function readAverageDurationMs(): number {
  if (typeof window === "undefined") return DEFAULT_ANALYSIS_MS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DURATIONS);
    if (!raw) return DEFAULT_ANALYSIS_MS;
    const arr = JSON.parse(raw) as number[];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_ANALYSIS_MS;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.max(20000, Math.min(120000, Math.round(avg)));
  } catch {
    return DEFAULT_ANALYSIS_MS;
  }
}

function AnalyzingScreen({
  steps,
  meta,
}: {
  steps: StreamSteps;
  meta: AnalysisMeta | null;
}) {
  const [jokeIndex, setJokeIndex] = useState(() =>
    Math.floor(Math.random() * LAWYER_JOKES.length)
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const totalMs = useMemo(() => readAverageDurationMs(), []);

  // Cycle through jokes every 8 seconds with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setJokeIndex((prev) => (prev + 1) % LAWYER_JOKES.length);
        setFadeIn(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Elapsed timer (drives progress + decompte)
  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.min(95, (elapsedMs / totalMs) * 100);
  const remainingSec = Math.max(1, Math.round((totalMs - elapsedMs) / 1000));

  const stepConfig: Array<{
    key: StreamStepKey;
    label: string;
    detail: string;
  }> = [
    {
      key: "judilibre",
      label: "Recherche Judilibre",
      detail:
        meta && meta.analyzedCount > 0
          ? `${meta.analyzedCount} / ${meta.totalFound} décisions`
          : "480 312 arrêts",
    },
    {
      key: "datagouv",
      label: "Interrogation data.gouv.fr",
      detail: "82 175 décisions",
    },
    {
      key: "claude",
      label: "Analyse jurimétrique & rédaction",
      detail: "Motifs · solutions · synthèse",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-6 lg:px-10 py-20">
        {/* Big progress */}
        <div className="flex flex-col items-center text-center mb-12">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-4 flex items-center gap-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--gold)" }}
            />
            Analyse en cours
          </div>
          <div
            className="font-serif font-medium leading-none tabular-nums"
            style={{
              fontSize: "96px",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
            }}
          >
            {Math.round(progress)}
            <span
              className="text-[40px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              %
            </span>
          </div>
          <div
            className="mt-6 w-full max-w-[420px] h-[2px] relative"
            style={{ background: "var(--line)" }}
          >
            <div
              className="absolute inset-y-0 left-0 transition-all duration-300"
              style={{ width: `${progress}%`, background: "var(--gold)" }}
            />
          </div>
          <div
            className="mt-3 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Estimation restante : <span className="tabular-nums">{remainingSec}s</span>
          </div>
        </div>

        {/* Steps — driven by real SSE events */}
        <div className="space-y-0">
          {stepConfig.map((step) => {
            const state = steps[step.key];
            const isDone = state === "done";
            const isActive = state === "active";
            return (
              <div key={step.key} className="flex items-center gap-4">
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {isDone ? (
                    <CheckCircle2
                      className="h-[14px] w-[14px]"
                      style={{ color: "var(--gold)" }}
                    />
                  ) : isActive ? (
                    <div
                      className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
                    />
                  ) : (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--line)" }}
                    />
                  )}
                </div>
                <div
                  className="flex-1 flex items-baseline justify-between gap-3 py-3"
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                >
                  <span
                    className="text-[14px]"
                    style={{
                      color: isDone || isActive ? "var(--ink)" : "var(--muted-foreground)",
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    className="text-[12px] font-mono tabular-nums"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {step.detail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lawyer joke */}
        <div
          className="mt-12 pl-4"
          style={{ borderLeft: "2px solid var(--gold)" }}
        >
          <div
            className="font-mono text-[9px] uppercase tracking-[0.22em] mb-2"
            style={{ color: "var(--gold)" }}
          >
            Le saviez-vous
          </div>
          <p
            className={`font-serif text-[16px] italic leading-relaxed transition-opacity duration-400 ${
              fadeIn ? "opacity-100" : "opacity-0"
            }`}
            style={{ color: "var(--ink)" }}
          >
            « {LAWYER_JOKES[jokeIndex]} »
          </p>
        </div>
      </div>
    </div>
  );
}

export function recordAnalysisDuration(ms: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DURATIONS);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    arr.push(ms);
    while (arr.length > 5) arr.shift();
    window.localStorage.setItem(STORAGE_KEY_DURATIONS, JSON.stringify(arr));
  } catch {
    // best-effort
  }
}



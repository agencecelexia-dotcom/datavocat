"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Scale,
  Loader2,
  Sparkles,
  BarChart3,
  Presentation,
  MessageCircleQuestion,
  ArrowRight,
  SkipForward,
  FileText,
  FileDown,
  Search,
  Database,
  Brain,
  ExternalLink,
  BookOpen,
  Table,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
} from "lucide-react";
import { parseAnalysisResponse, ParsedAnalysis } from "@/lib/parse-analysis";
import { TOUR_QUERY } from "@/hooks/use-product-tour";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { AnalysisSlides } from "@/components/analysis/slides";
import { AnalysisChat } from "@/components/analysis/chat";
import { SourcesAnnex } from "@/components/analysis/sources-annex";
import { EvidenceTable } from "@/components/analysis/evidence-table";
import { formatMarkdownSafe } from "@/lib/format-markdown";
import { CopyMarkdown } from "@/components/ui/copy-markdown";

interface ClarifyQuestion {
  id: string;
  question: string;
  type: "text" | "choice";
  choices?: string[];
}

type Phase = "input" | "clarify" | "analyzing" | "done";

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
  const [showSources, setShowSources] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  // Clarification state
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
    const answeredQuestions = questions.filter(
      (q) => answers[q.id] && answers[q.id].trim()
    );
    if (answeredQuestions.length > 0) {
      enriched += "\n\nPRECISIONS COMPLEMENTAIRES :";
      for (const q of answeredQuestions) {
        enriched += `\n- ${q.question} -> ${answers[q.id].trim()}`;
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
    setShowSources(false);

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

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setResponse(text);
        }
      }
    } catch {
      setResponse("Erreur de connexion. Vérifiez votre connexion internet.");
    } finally {
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
    setShowSources(false);
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (!response) return;
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
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `datavocat-analyse.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent fail
    }
  };

  const examples = [
    "Mon client est un salarie licencie pour faute grave apres 15 ans d'anciennete dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?",
    "Une OS non signataire veut contester un accord collectif sur le temps de travail dans une entreprise de 500 salaries. L'accord a ete signe par des syndicats representant 55% des votes. Quels arguments privilegier ?",
    "Mon client locataire d'un bail commercial a Paris se voit refuser le renouvellement par le bailleur. Le bail dure depuis 12 ans. Quelles indemnites d'eviction peut-il esperer ?",
  ];

  const answeredCount = questions.filter(
    (q) => answers[q.id] && answers[q.id].trim()
  ).length;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col" data-tour-phase={phase} data-tour-active-view={activeView} data-tour="tour-page">
      {phase === "input" ? (
        /* INPUT STATE — Premium Hero */
        <div className="gradient-hero flex flex-1 flex-col items-center justify-center gap-8 px-4">
          {/* Hero */}
          <div className="animate-fade-in-up text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 animate-float items-center justify-center rounded-2xl bg-[#1e3a5f]/5 shadow-sm">
              <Scale className="h-7 w-7 text-[#1e3a5f]" />
            </div>
            <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl md:text-5xl">
              Analysez votre affaire
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
              Decrivez la situation juridique. L&apos;IA croise{" "}
              <span className="font-medium text-foreground">500 000+ decisions</span>{" "}
              pour produire statistiques et recommandations.
            </p>
          </div>

          {/* Input card */}
          <form onSubmit={handleSubmit} className="w-full max-w-3xl animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div data-tour="query-input" className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/[0.03] transition-all duration-300 focus-within:border-[#1e3a5f]/20 focus-within:shadow-xl focus-within:shadow-[#1e3a5f]/[0.04]">
              {/* Shimmer effect on focus */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 animate-shimmer" />

              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Decrivez la situation juridique de votre client, le type de contentieux, les arguments envisages..."
                className="relative z-10 min-h-[100px] resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-sm leading-relaxed shadow-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/40 focus:border-0 focus:ring-0 focus-visible:ring-0 focus-visible:border-0 sm:min-h-[140px] sm:px-5 sm:pt-5 sm:text-[15px]"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
              />
              <div className="relative z-10 flex items-center justify-end border-t border-border/30 px-3 py-2.5 sm:justify-between sm:px-4 sm:py-3">
                <div className="hidden items-center gap-3 sm:flex">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                    <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">Entrée</kbd>
                  </span>
                </div>
                <Button
                  data-tour="analyze-button"
                  type="submit"
                  className="cursor-pointer gap-2 bg-[#1e3a5f] px-5 text-sm font-semibold text-white shadow-md shadow-[#1e3a5f]/20 transition-all duration-300 hover:bg-[#162d4a] hover:shadow-lg hover:shadow-[#1e3a5f]/25 hover:-translate-y-px disabled:opacity-40"
                  disabled={!query.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyser
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Examples */}
          <div data-tour="examples" className="w-full max-w-3xl space-y-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Exemples de demandes
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className="group/ex cursor-pointer rounded-xl border border-border/40 bg-card p-3 text-left text-xs leading-relaxed text-muted-foreground transition-all duration-300 hover:border-[#1e3a5f]/15 hover:bg-card hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-1 sm:p-4 sm:text-[13px]"
                >
                  <span className="line-clamp-3">{example}</span>
                  <span className="mt-2 flex items-center gap-1 text-xs font-medium text-[#c9a96e] opacity-0 transition-opacity duration-200 group-hover/ex:opacity-100">
                    <ArrowRight className="h-3 w-3" />
                    Utiliser
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground/50 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Judilibre + data.gouv.fr
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Donnees chiffrees
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              IA Claude
            </span>
          </div>

        </div>
      ) : phase === "clarify" && loading ? (
        /* ═══ LOADING CLARIFICATION QUESTIONS ═══ */
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#1e3a5f]/10 border-t-[#c9a96e]" style={{ animationDuration: "2s" }} />
            <MessageCircleQuestion className="absolute inset-0 m-auto h-6 w-6 text-[#1e3a5f]" />
          </div>
          <div className="text-center">
            <h2 className="font-serif text-xl text-[#1e3a5f]">
              Preparation des questions
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              L&apos;IA analyse votre demande pour poser les bonnes questions...
            </p>
          </div>
          <Card className="w-full max-w-lg border-border/40 bg-card p-4 shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">{query}</p>
          </Card>
        </div>
      ) : phase === "clarify" && !loading ? (
        /* ═══ CLARIFICATION STATE ═══ */
        <div data-tour="clarify-section" className="flex flex-1 flex-col gap-6 overflow-y-auto py-6">
          <Card className="shrink-0 border-border/60 bg-card p-4 shadow-sm">
            <p className="text-sm leading-relaxed">{query}</p>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <MessageCircleQuestion className="h-5 w-5" />
              <h2 className="font-serif text-xl">
                Precisions pour affiner l&apos;analyse
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Repondez aux questions ci-dessous pour une analyse plus precise.
              Vous pouvez aussi passer directement.
            </p>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={q.id} className="border-border/40 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <label className="mb-3 block text-sm font-medium leading-relaxed">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  {q.question}
                </label>
                {q.type === "choice" && q.choices ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.choices.map((choice) => (
                      <button
                        key={choice}
                        onClick={() => setAnswer(q.id, choice)}
                        className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-all duration-200 ${
                          answers[q.id] === choice
                            ? "border-[#1e3a5f] bg-[#1e3a5f]/10 font-medium text-[#1e3a5f] shadow-sm"
                            : "border-border text-muted-foreground hover:border-[#1e3a5f]/40 hover:text-foreground"
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                    {answers[q.id] &&
                      !q.choices.includes(answers[q.id]) && (
                        <span className="rounded-full border border-[#1e3a5f] bg-[#1e3a5f]/10 px-4 py-1.5 text-sm font-medium text-[#1e3a5f]">
                          {answers[q.id]}
                        </span>
                      )}
                    <Input
                      placeholder="Autre..."
                      className="mt-2 max-w-xs transition-all duration-200 focus:border-[#1e3a5f]"
                      value={
                        q.choices.includes(answers[q.id] || "")
                          ? ""
                          : answers[q.id] || ""
                      }
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  </div>
                ) : (
                  <Input
                    placeholder="Votre reponse..."
                    className="mt-2 transition-all duration-200 focus:border-[#1e3a5f]"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}
              </Card>
            ))}
          </div>

          <div data-tour="clarify-buttons" className="flex shrink-0 items-center justify-between border-t border-border/40 pt-4">
            <Button
              variant="ghost"
              className="cursor-pointer gap-2 text-muted-foreground transition-all duration-200"
              onClick={handleSkipClarification}
            >
              <SkipForward className="h-4 w-4" />
              Passer et analyser
            </Button>
            <Button
              className="cursor-pointer gap-2 bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f] hover:shadow-md"
              onClick={handleSubmitAnswers}
              disabled={answeredCount === 0}
            >
              Lancer l&apos;analyse
              {answeredCount > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {answeredCount}/{questions.length}
                </span>
              )}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* ANALYZING + DONE STATE */
        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
          {/* Phase step indicators — minimal pill style */}
          <div className="shrink-0">
            <div className="flex items-center justify-center gap-1">
              {[
                { label: "Saisie", done: true },
                { label: "Clarification", done: phase === "analyzing" || phase === "done" },
                { label: "Analyse", done: phase === "done", active: phase === "analyzing" },
                { label: "Resultats", done: false, active: phase === "done" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-300 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                      step.done
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : step.active
                          ? "bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : step.active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {step.label}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`mx-0.5 h-px w-3 transition-all duration-300 sm:mx-1 sm:w-6 ${step.done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User query card */}
          <Card className="shrink-0 border-border/40 border-l-4 border-l-[#1e3a5f] bg-card p-4 shadow-sm">
            <p className="text-sm leading-relaxed">{query}</p>
            {questions.length > 0 &&
              Object.keys(answers).some((k) => answers[k]?.trim()) && (
                <div className="mt-2 border-t border-border/30 pt-2">
                  {questions
                    .filter((q) => answers[q.id]?.trim())
                    .map((q) => (
                      <p
                        key={q.id}
                        className="text-xs text-muted-foreground"
                      >
                        <span className="font-medium">{q.question}</span>{" "}
                        &rarr; {answers[q.id]}
                      </p>
                    ))}
                </div>
              )}
          </Card>

          {/* Source count + Fiabilite + View toggle */}
          {phase === "done" && parsedData && (
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {/* Sources & fiabilite badges */}
              <SourcesBadge data={parsedData} onClick={() => setShowSources(!showSources)} />
              <FiabiliteBadge fiabilite={parsedData.fiabilite} />

              <div className="flex-1" />

              {/* View tabs - refined pill style */}
              <div data-tour="tour-view-tabs" className="flex gap-0.5 rounded-xl border border-border/40 bg-muted/50 p-0.5">
                {[
                  {
                    key: "text" as const,
                    label: "Rapport",
                    icon: FileText,
                  },
                  {
                    key: "dashboard" as const,
                    label: "Dashboard",
                    icon: BarChart3,
                  },
                  {
                    key: "tableau" as const,
                    label: "Tableau",
                    icon: Table,
                  },
                  {
                    key: "sources" as const,
                    label: "Sources",
                    icon: BookOpen,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveView(tab.key)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all duration-200 sm:px-3.5 sm:py-1.5 ${
                      activeView === tab.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sources panel (collapsible) */}
          {showSources && parsedData && parsedData.sources.length > 0 && (
            <SourcesPanel sources={parsedData.sources} />
          )}

          {/* Content area — artifact-style container */}
          <div
            ref={responseRef}
            className="flex-1 overflow-y-auto rounded-2xl border border-border/30 bg-card shadow-lg shadow-black/[0.03]"
          >
            {/* Artifact header bar */}
            {phase === "done" && (
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-card/95 px-3 py-2 backdrop-blur-sm sm:px-5 sm:py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1e3a5f]/10">
                    {activeView === "text" ? <FileText className="h-3 w-3 text-[#1e3a5f]" /> : activeView === "dashboard" ? <BarChart3 className="h-3 w-3 text-[#1e3a5f]" /> : activeView === "sources" ? <BookOpen className="h-3 w-3 text-[#1e3a5f]" /> : <Table className="h-3 w-3 text-[#1e3a5f]" />}
                  </div>
                  <span className="hidden font-medium text-foreground sm:inline">
                    {activeView === "text" ? "Rapport d'analyse" : activeView === "dashboard" ? "Dashboard jurimetrique" : activeView === "sources" ? "Annexe des sources" : "Tableau de preuve"}
                  </span>
                  <span className="hidden text-muted-foreground/50 sm:inline">|</span>
                  <span className="hidden sm:inline">Datavocat</span>
                </div>
                <div data-tour="tour-export-buttons" className="flex items-center gap-1.5">
                  <CopyMarkdown content={response} />
                  <button
                    onClick={() => handleExport("pdf")}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-border/40 bg-background px-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <FileDown className="h-3 w-3" />
                    PDF
                  </button>
                  <button
                    onClick={() => handleExport("docx")}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-border/40 bg-background px-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <FileDown className="h-3 w-3" />
                    DOCX
                  </button>
                </div>
              </div>
            )}

            {/* Loading screen with lawyer jokes — hides streaming text */}
            {phase === "analyzing" && (
              <div data-tour="analyzing-screen"><AnalyzingScreen /></div>
            )}

            {/* Text view — premium document rendering */}
            {activeView === "text" && phase === "done" && response && (
              <div className="animate-fade-in-up px-4 py-4 sm:px-6 sm:py-6 lg:px-12">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-serif prose-h2:text-xl prose-h2:text-[#1e3a5f] prose-h3:text-base prose-h3:text-foreground prose-strong:text-foreground prose-a:text-[#1e3a5f] prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdownSafe(response),
                  }}
                />
              </div>
            )}

            {/* Dashboard view */}
            {activeView === "dashboard" && phase === "done" && parsedData && (
              <div className="animate-fade-in-up p-3 sm:p-6">
                <AnalysisDashboard data={parsedData} />
              </div>
            )}

            {/* Evidence table view */}
            {activeView === "tableau" && phase === "done" && parsedData && parsedData.evidenceTable && (
              <div className="animate-fade-in-up p-3 sm:p-6">
                <EvidenceTable data={parsedData.evidenceTable} />
              </div>
            )}
            {activeView === "tableau" && phase === "done" && parsedData && !parsedData.evidenceTable && (
              <div className="flex flex-1 items-center justify-center p-12 text-center">
                <div>
                  <Table className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">Aucun tableau de preuve disponible pour cette analyse.</p>
                  <p className="mt-1 text-xs text-slate-400">Le tableau est genere automatiquement lors de l&apos;analyse.</p>
                </div>
              </div>
            )}

            {/* Sources annex view */}
            {activeView === "sources" && phase === "done" && parsedData && (
              <div className="animate-fade-in-up p-3 sm:p-6">
                <SourcesAnnex data={parsedData} />
              </div>
            )}
          </div>

          {/* Follow-up chat */}
          {phase === "done" && response && (
            <AnalysisChat analysisContext={response} query={query} />
          )}

          {/* Suggested follow-up + actions merged */}
          {phase === "done" && (
            <div className="shrink-0 space-y-3">
              {/* Suggested follow-up questions */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground/60">Approfondir :</span>
                {[
                  "Et si on changeait de juridiction ?",
                  "Quels sont les risques en appel ?",
                  "Comment renforcer cet argument ?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const enriched = query.trim() + "\n\nQUESTION COMPLEMENTAIRE : " + suggestion;
                      launchAnalysis(enriched);
                    }}
                    className="cursor-pointer rounded-full border border-border/40 bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all duration-200 hover:border-[#1e3a5f]/20 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {/* New analysis button */}
              <Button
                onClick={handleNewAnalysis}
                variant="outline"
                size="sm"
                className="cursor-pointer gap-2 border-border/40 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Nouvelle analyse
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ ANALYZING SCREEN (lawyer jokes) ═══ */
function AnalyzingScreen() {
  const [jokeIndex, setJokeIndex] = useState(() =>
    Math.floor(Math.random() * LAWYER_JOKES.length)
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const steps = [
    { icon: Search, text: "Recherche dans Judilibre (Cour de cassation)...", duration: 8000 },
    { icon: Database, text: "Interrogation de data.gouv.fr...", duration: 5000 },
    { icon: Brain, text: "Analyse des decisions trouvees...", duration: 10000 },
    { icon: Scale, text: "Redaction du rapport strategique...", duration: 25000 },
  ];

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

  // Progress through steps
  useEffect(() => {
    const stepTimers = steps.map((step, i) => {
      const delay = steps.slice(0, i).reduce((sum, s) => sum + s.duration, 0);
      return setTimeout(() => setStepIndex(i), delay);
    });
    return () => stepTimers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // never reach 100 until done
        return prev + 0.3;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-5 px-4 py-6 sm:min-h-[400px] sm:gap-8 sm:py-8">
      {/* Animated scale icon */}
      <div className="relative">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#1e3a5f]/10 border-t-[#c9a96e] sm:h-20 sm:w-20" style={{ animationDuration: "3s" }} />
        <Scale className="absolute inset-0 m-auto h-6 w-6 text-[#1e3a5f] sm:h-8 sm:w-8" />
      </div>

      <div className="text-center">
        <h2 className="font-serif text-xl text-[#1e3a5f] sm:text-2xl">
          Analyse en cours
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cela peut prendre 30 a 60 secondes
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#1e3a5f]/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#c9a96e] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="w-full max-w-sm space-y-3">
        {steps.map((step, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                isDone
                  ? "text-[#2d6a4f]"
                  : isActive
                    ? "text-[#1e3a5f] font-medium"
                    : "text-muted-foreground/40"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2d6a4f]" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <step.icon className="h-4 w-4 shrink-0" />
              )}
              <span>{step.text}</span>
            </div>
          );
        })}
      </div>

      {/* Lawyer joke */}
      <div className="w-full max-w-lg rounded-xl border border-[#c9a96e]/20 bg-[#c9a96e]/5 p-3 sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#c9a96e]">
          Le saviez-vous ?
        </p>
        <p
          className={`text-sm italic leading-relaxed text-[#1e3a5f]/80 transition-opacity duration-400 ${
            fadeIn ? "opacity-100" : "opacity-0"
          }`}
        >
          &laquo; {LAWYER_JOKES[jokeIndex]} &raquo;
        </p>
      </div>
    </div>
  );
}

/* ═══ SOURCES BADGE ═══ */
function SourcesBadge({
  data,
  onClick,
}: {
  data: ParsedAnalysis;
  onClick: () => void;
}) {
  const count = data.sourceCount;
  return (
    <button
      onClick={onClick}
      title={`${count} decision${count !== 1 ? "s" : ""} de justice identifiee${count !== 1 ? "s" : ""} avec reference verifiable (ECLI, n° de pourvoi ou reference Cass.). Cliquez pour afficher le detail.`}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-3.5 py-1.5 text-sm font-medium text-[#1e3a5f] transition-all duration-200 hover:bg-[#1e3a5f]/10 hover:shadow-sm"
    >
      <BookOpen className="h-4 w-4" />
      <span>
        {count} source{count !== 1 ? "s" : ""}
      </span>
      {count > 0 && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      )}
    </button>
  );
}

/* ═══ FIABILITE BADGE ═══ */
function FiabiliteBadge({
  fiabilite,
}: {
  fiabilite: ParsedAnalysis["fiabilite"];
}) {
  const config: Record<
    string,
    { bg: string; text: string; icon: typeof ShieldCheck }
  > = {
    "Tres eleve": {
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: ShieldCheck,
    },
    Eleve: {
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: ShieldCheck,
    },
    Moyen: {
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-400",
      icon: ShieldAlert,
    },
    Faible: {
      bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
      text: "text-rose-700 dark:text-rose-400",
      icon: ShieldX,
    },
    "Tres faible": {
      bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
      text: "text-rose-700 dark:text-rose-400",
      icon: ShieldX,
    },
  };

  const c = config[fiabilite.label] || config["Faible"];
  const Icon = c.icon;

  const barColor = fiabilite.score >= 60 ? "#2d6a4f" : fiabilite.score >= 40 ? "#ca6702" : "#9b2226";

  return (
    <div
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${c.bg} ${c.text}`}
    >
      <Icon className="h-4 w-4" />
      <span>
        Indice de fiabilite : {fiabilite.label} ({fiabilite.score}/100)
      </span>
      {/* Detailed tooltip on hover */}
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-96 rounded-xl border bg-card p-4 text-xs text-foreground shadow-xl group-hover:block">
        <p className="font-serif font-semibold text-sm mb-1">Indice de fiabilite de l&apos;analyse</p>
        <p className="text-muted-foreground mb-3 leading-relaxed">
          Cet indice mesure la qualite et la verificabilite des donnees utilisees.
          Plus les sources sont nombreuses, recentes et verifiables, plus l&apos;indice est eleve.
        </p>

        {/* Global bar */}
        <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fiabilite.score}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Factor breakdown */}
        {fiabilite.factors && fiabilite.factors.length > 0 && (
          <div className="space-y-2.5">
            {fiabilite.factors.map((factor, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className={factor.impact === "positive" ? "text-emerald-600" : factor.impact === "negative" ? "text-rose-600" : "text-amber-600"}>
                      {factor.impact === "positive" ? "+" : factor.impact === "negative" ? "−" : "~"}
                    </span>
                    {factor.name}
                  </span>
                  {factor.maxScore > 0 && (
                    <span className="text-muted-foreground">{factor.score}/{factor.maxScore}</span>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{factor.description}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 pt-2 border-t text-[10px] text-muted-foreground/60 italic leading-relaxed">
          L&apos;indice de fiabilite est un indicateur automatise. Il ne garantit pas l&apos;exactitude
          des resultats mais evalue la qualite des sources mobilisees.
        </p>
      </div>
    </div>
  );
}

/* ═══ SOURCES PANEL ═══ */
function SourcesPanel({
  sources,
}: {
  sources: ParsedAnalysis["sources"];
}) {
  return (
    <Card className="shrink-0 border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.02] p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-sm font-semibold text-primary">
          Sources de jurisprudence ({sources.length})
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-white p-3 transition-all duration-200 hover:border-[#1e3a5f]/40 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                {source.reference}
              </p>
              {(source.chamber || source.date) && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[source.chamber, source.date, source.solution]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
            </div>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          </a>
        ))}
      </div>
    </Card>
  );
}


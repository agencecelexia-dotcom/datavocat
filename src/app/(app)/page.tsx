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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  Star,
} from "lucide-react";
import Link from "next/link";
import { parseAnalysisResponse, ParsedAnalysis } from "@/lib/parse-analysis";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { AnalysisSlides } from "@/components/analysis/slides";
import { AnalysisChat } from "@/components/analysis/chat";
import { formatMarkdownSafe } from "@/lib/format-markdown";
import { CopyMarkdown } from "@/components/ui/copy-markdown";
import { useFavorites } from "@/hooks/use-favorites";

interface ClarifyQuestion {
  id: string;
  question: string;
  type: "text" | "choice";
  choices?: string[];
}

type Phase = "input" | "clarify" | "analyzing" | "done";

export default function AnalyzePage() {
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "text" | "dashboard" | "slides"
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
      setResponse("Erreur de connexion. Verifiez votre connexion internet.");
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
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      {phase === "input" ? (
        /* INPUT STATE */
        <div className="flex flex-1 flex-col items-center justify-center gap-10 px-4">
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <Scale className="h-10 w-10 text-[#c9a96e]" />
              <h1 className="font-serif text-5xl tracking-tight text-[#1e3a5f]">
                Datavocat
              </h1>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Decrivez votre affaire. L&apos;IA analyse la jurisprudence
              <br />
              et produit statistiques et recommandations strategiques.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-4">
            <Card className="overflow-hidden border-border/40 bg-white shadow-md transition-shadow duration-200 focus-within:shadow-lg">
              <div className="relative">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Decrivez la situation juridique de votre client, le type de contentieux, les arguments envisages..."
                  className="min-h-[150px] resize-none border-0 bg-transparent pr-14 text-base shadow-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-0 focus:ring-0 focus-visible:ring-0 focus-visible:border-0"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Ctrl+Entree pour envoyer
                  </p>
                  <Button
                    type="submit"
                    className="cursor-pointer gap-2 bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f] hover:shadow-md"
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
            </Card>
          </form>

          <div className="w-full max-w-3xl space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-[#c9a96e]" />
              Exemples de demandes
            </p>
            <div className="grid gap-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className="cursor-pointer rounded-lg border border-border/40 bg-white p-4 text-left text-sm leading-relaxed text-muted-foreground shadow-sm transition-all duration-200 hover:border-[#c9a96e]/50 hover:shadow-md hover:-translate-y-0.5"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Favorites widget */}
          {favorites.length > 0 && (
            <div className="w-full max-w-3xl space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Star className="h-4 w-4 fill-[#c9a96e] text-[#c9a96e]" />
                Mes favoris
              </p>
              <Card className="divide-y divide-border/30 border-border/40 bg-white shadow-sm">
                {favorites.slice(0, 5).map((fav) => (
                  <Link
                    key={fav.id}
                    href={
                      fav.type === "decision"
                        ? `/decisions/${fav.id}`
                        : `/veille`
                    }
                    className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm transition-all duration-200 first:rounded-t-lg last:rounded-b-lg hover:bg-[#f8fafc]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Star className="h-3.5 w-3.5 shrink-0 fill-[#c9a96e] text-[#c9a96e]" />
                      <span className="truncate font-medium text-[#1e3a5f]">
                        {fav.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{fav.reference}</span>
                      {fav.date && (
                        <span>
                          {new Date(fav.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </Card>
            </div>
          )}
        </div>
      ) : phase === "clarify" && !loading ? (
        /* ═══ CLARIFICATION STATE ═══ */
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-6">
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

          <div className="flex shrink-0 items-center justify-between border-t border-border/40 pt-4">
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
          {/* Phase step indicators */}
          <div className="shrink-0">
            <div className="flex items-center justify-center gap-0">
              {[
                { label: "Saisie", done: true },
                { label: "Clarification", done: phase === "analyzing" || phase === "done" },
                { label: "Analyse", done: phase === "done", active: phase === "analyzing" },
                { label: "Resultats", done: false, active: phase === "done" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                        step.done
                          ? "bg-[#2d6a4f] text-white"
                          : step.active
                            ? "bg-[#1e3a5f] text-white shadow-md ring-4 ring-[#1e3a5f]/20"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-xs font-medium ${step.done || step.active ? "text-[#1e3a5f]" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`mx-2 mb-5 h-0.5 w-12 transition-all duration-200 ${step.done ? "bg-[#2d6a4f]" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User query card */}
          <Card className="shrink-0 border-border/40 border-l-4 border-l-[#1e3a5f] bg-white p-4 shadow-sm">
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

              {/* View tabs - pill style */}
              <div className="flex gap-0.5 rounded-full bg-[#f0f2f5] p-1">
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
                    key: "slides" as const,
                    label: "Presentation",
                    icon: Presentation,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveView(tab.key)}
                    className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      activeView === tab.key
                        ? "bg-[#1e3a5f] text-white shadow-sm"
                        : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sources panel (collapsible) */}
          {showSources && parsedData && parsedData.sources.length > 0 && (
            <SourcesPanel sources={parsedData.sources} />
          )}

          {/* Content area */}
          <div
            ref={responseRef}
            className="flex-1 overflow-y-auto rounded-lg border border-border/40 border-t-4 border-t-[#1e3a5f] bg-white p-6 shadow-sm"
          >
            {/* Loading animation */}
            {loading && !response && (
              <div className="space-y-6 py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
                    <Scale className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                  </div>
                  <p className="font-serif text-lg text-foreground">
                    Analyse en cours
                  </p>
                </div>
                <div className="mx-auto max-w-sm space-y-3">
                  {[
                    {
                      icon: Search,
                      text: "Recherche Judilibre (Cour de cassation)...",
                      delay: "0s",
                    },
                    {
                      icon: Database,
                      text: "Interrogation de data.gouv.fr...",
                      delay: "0.5s",
                    },
                    {
                      icon: Brain,
                      text: "Analyse jurimetrique par IA...",
                      delay: "1s",
                    },
                  ].map((step, i) => (
                    <div
                      key={i}
                      className="flex animate-pulse items-center gap-3 text-sm text-muted-foreground"
                      style={{ animationDelay: step.delay }}
                    >
                      <step.icon className="h-4 w-4 shrink-0" />
                      <span>{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text view */}
            {(activeView === "text" || phase === "analyzing") && response && (
              <>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-serif prose-h2:text-xl prose-h2:text-primary prose-h3:text-base prose-strong:text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdownSafe(response),
                  }}
                />
                {loading && response && (
                  <span className="inline-block h-4 w-2 animate-pulse bg-gold" />
                )}
              </>
            )}

            {/* Dashboard view */}
            {activeView === "dashboard" && phase === "done" && parsedData && (
              <AnalysisDashboard data={parsedData} />
            )}

            {/* Slides view */}
            {activeView === "slides" && phase === "done" && parsedData && (
              <AnalysisSlides data={parsedData} query={query} />
            )}
          </div>

          {/* Follow-up chat */}
          {phase === "done" && response && (
            <AnalysisChat analysisContext={response} query={query} />
          )}

          {/* Suggested follow-up questions */}
          {phase === "done" && response && (
            <div className="shrink-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Questions suggerees
              </p>
              <div className="flex flex-wrap gap-2">
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
                    className="cursor-pointer rounded-full border-2 border-[#c9a96e]/40 bg-[#c9a96e]/5 px-4 py-2 text-sm font-medium text-[#1e3a5f] transition-all duration-200 hover:border-[#c9a96e] hover:bg-[#c9a96e]/15 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions bar */}
          {phase === "done" && (
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border/30 bg-white p-3 shadow-sm">
              <Button
                onClick={handleNewAnalysis}
                variant="outline"
                className="cursor-pointer gap-2 border-[#1e3a5f]/30 text-[#1e3a5f] transition-all duration-200 hover:bg-[#1e3a5f]/5"
              >
                Nouvelle analyse
              </Button>
              <div className="flex-1" />
              <CopyMarkdown content={response} />
              <Button
                size="sm"
                className="cursor-pointer gap-2 bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f] hover:shadow-md"
                onClick={() => handleExport("pdf")}
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                size="sm"
                className="cursor-pointer gap-2 bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f] hover:shadow-md"
                onClick={() => handleExport("docx")}
              >
                <FileDown className="h-3.5 w-3.5" />
                DOCX
              </Button>
            </div>
          )}
        </div>
      )}
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

  return (
    <div
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${c.bg} ${c.text}`}
    >
      <Icon className="h-4 w-4" />
      <span>
        Fiabilite : {fiabilite.label} ({fiabilite.score}/100)
      </span>
      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-72 rounded-lg border bg-card p-3 text-xs text-foreground shadow-lg group-hover:block">
        <p className="font-medium">Details du score de fiabilite</p>
        <p className="mt-1 text-muted-foreground">{fiabilite.details}</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${fiabilite.score}%`,
              backgroundColor:
                fiabilite.score >= 60
                  ? "#2d6a4f"
                  : fiabilite.score >= 40
                    ? "#ca6702"
                    : "#9b2226",
            }}
          />
        </div>
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


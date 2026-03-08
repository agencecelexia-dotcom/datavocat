"use client";

import { useState, useEffect, useCallback } from "react";
import { ParsedAnalysis } from "@/lib/parse-analysis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Scale,
  Target,
  BarChart3,
  Landmark,
  Banknote,
  Shield,
  AlertTriangle,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// --- Color palette ---
const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";

const BAR_COLORS = [NAVY, GOLD, EMERALD, "#5b8ec9", "#ca6702", "#7c3aed", "#9b2226"];

// --- Types ---

interface SlideDefinition {
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

interface SourceEntry {
  type: string;
  reference: string;
  url: string;
  date: string;
  chamber: string;
  solution: string;
}

// Extend ParsedAnalysis for optional fields the component uses
type AnalysisData = ParsedAnalysis & {
  sources?: SourceEntry[];
  sourceCount?: number;
  fiabilite?: { score: number; label: string; details: string };
};

// --- Slide shell ---

function SlideShell({
  slide,
  index,
  total,
}: {
  slide: SlideDefinition;
  index: number;
  total: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="border-b px-8 py-5"
        style={{
          background: `linear-gradient(135deg, ${NAVY}08 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${NAVY}12` }}
          >
            {slide.icon}
          </div>
          <h2
            className="text-xl font-semibold tracking-tight"
            style={{ color: NAVY }}
          >
            {slide.title}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">{slide.content}</div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-8 py-3">
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: NAVY }}>
          <Scale className="h-3.5 w-3.5" />
          <span style={{ fontFamily: "'Georgia', serif" }}>Datavocat</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

// --- Helpers ---

function formatCurrency(v: number | null): string {
  if (v === null) return "\u2014";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

function parseBulletLines(text: string): React.ReactNode[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const cleaned = line
        .replace(/^[-*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\*\*/g, "");

      const isNumbered = /^\d+\./.test(line.trim());
      const numberMatch = line.trim().match(/^(\d+)\./);

      if (isNumbered && numberMatch) {
        return (
          <div key={i} className="flex gap-3 py-2">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              {numberMatch[1]}
            </span>
            <span className="text-sm leading-relaxed">{cleaned}</span>
          </div>
        );
      }

      if (line.trimStart().startsWith("-") || line.trimStart().startsWith("*")) {
        return (
          <div key={i} className="flex gap-3 py-1.5">
            <span
              className="mt-2 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: NAVY }}
            />
            <span className="text-sm leading-relaxed">{cleaned}</span>
          </div>
        );
      }

      return (
        <p key={i} className="mb-2 text-sm leading-relaxed">
          {cleaned}
        </p>
      );
    });
}

// --- Build slides ---

function buildSlides(data: AnalysisData, query: string): SlideDefinition[] {
  const slides: SlideDefinition[] = [];

  // 1. Title slide
  slides.push({
    icon: <Scale className="h-5 w-5" style={{ color: NAVY }} />,
    title: "Analyse Jurimetrique",
    content: (
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${NAVY}10` }}
        >
          <Scale className="h-10 w-10" style={{ color: NAVY }} />
        </div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Georgia', serif", color: NAVY }}
        >
          Analyse Jurimetrique
        </h1>
        <p className="max-w-lg text-base text-muted-foreground leading-relaxed">
          {query}
        </p>
        {data.tauxSuccesGlobal !== null && (
          <div
            className="mt-2 rounded-2xl px-10 py-5"
            style={{
              background: `linear-gradient(135deg, ${NAVY}0D 0%, ${GOLD}15 100%)`,
              border: `1px solid ${GOLD}40`,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Taux de succes estime
            </p>
            <p
              className="mt-1 text-5xl font-bold"
              style={{ color: NAVY }}
            >
              {data.tauxSuccesGlobal}
              <span className="text-3xl" style={{ color: GOLD }}>%</span>
            </p>
          </div>
        )}
        {(data.sourceCount ?? data.echantillon) !== null && (
          <p className="text-sm text-muted-foreground">
            Base sur {data.sourceCount ?? data.echantillon} decisions de jurisprudence
          </p>
        )}
      </div>
    ),
  });

  // 2. Situation slide
  if (data.situation) {
    slides.push({
      icon: <Target className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Analyse de la situation",
      content: (
        <div className="max-w-2xl space-y-1">
          {parseBulletLines(data.situation)}
        </div>
      ),
    });
  }

  // 3. Arguments chart slide
  if (data.arguments.length > 0) {
    const chartData = data.arguments.map((a, i) => ({
      name: a.name.length > 30 ? a.name.slice(0, 28) + "\u2026" : a.name,
      taux: a.taux ?? 0,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }));

    slides.push({
      icon: <BarChart3 className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Arguments & Taux de succes",
      content: (
        <div className="h-full">
          <div style={{ height: Math.max(240, data.arguments.length * 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 10, right: 50, top: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: NAVY }}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Succes"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${NAVY}20`,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="taux" radius={[0, 6, 6, 0]} barSize={24}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    });
  }

  // 4. Jurisdictions slide
  if (data.juridictions.length > 0) {
    slides.push({
      icon: <Landmark className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Analyse par juridiction",
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.juridictions.map((j, i) => {
            const taux = j.taux ?? 0;
            return (
              <div
                key={i}
                className="rounded-xl border p-4"
                style={{ borderColor: `${BAR_COLORS[i % BAR_COLORS.length]}30` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>
                      {j.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                    {j.taux !== null ? `${j.taux}%` : "\u2014"}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${taux}%`,
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
                {j.delai && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Delai moyen : {j.delai}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ),
    });
  }

  // 5. Montants slide
  if (data.montants.min !== null || data.montants.max !== null) {
    const montantCards = [
      { label: "Minimum", value: data.montants.min, color: EMERALD, bg: `${EMERALD}08` },
      { label: "Median", value: data.montants.median, color: NAVY, bg: `${NAVY}08` },
      { label: "Maximum", value: data.montants.max, color: GOLD, bg: `${GOLD}15` },
    ];

    slides.push({
      icon: <Banknote className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Montants & Indemnites",
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <div className="grid w-full max-w-2xl grid-cols-3 gap-6">
            {montantCards.map((card, i) => (
              <div
                key={i}
                className="rounded-xl border p-6 text-center"
                style={{
                  backgroundColor: card.bg,
                  borderColor: `${card.color}25`,
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p
                  className={`mt-3 font-bold ${i === 1 ? "text-3xl" : "text-2xl"}`}
                  style={{ color: card.color }}
                >
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>
          {/* Gradient bar */}
          <div
            className="h-3 w-72 rounded-full opacity-80"
            style={{
              background: `linear-gradient(to right, ${EMERALD}, ${NAVY}, ${GOLD})`,
            }}
          />
        </div>
      ),
    });
  }

  // 6. Sources slide
  const sources = (data as AnalysisData).sources;
  if (sources && sources.length > 0) {
    slides.push({
      icon: <BookOpen className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Sources jurisprudentielles",
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((src, i) => (
            <div
              key={i}
              className="group rounded-xl border p-4 transition-colors hover:border-[var(--gold)]"
              style={
                {
                  "--gold": `${GOLD}60`,
                  borderColor: `${NAVY}15`,
                } as React.CSSProperties
              }
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className="text-sm font-semibold leading-tight"
                  style={{ color: NAVY }}
                >
                  {src.reference}
                </span>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <ExternalLink className="h-4 w-4" style={{ color: GOLD }} />
                  </a>
                )}
              </div>
              {src.date && (
                <p className="text-xs text-muted-foreground">{src.date}</p>
              )}
              {src.chamber && (
                <p className="mt-1 text-xs text-muted-foreground">{src.chamber}</p>
              )}
              {src.solution && (
                <p
                  className="mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${EMERALD}12`,
                    color: EMERALD,
                  }}
                >
                  {src.solution}
                </p>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  // 7. Recommandation slide
  if (data.recommandation) {
    slides.push({
      icon: <Shield className="h-5 w-5" style={{ color: NAVY }} />,
      title: "Recommandation strategique",
      content: (
        <div className="max-w-2xl space-y-1">
          {parseBulletLines(data.recommandation)}
        </div>
      ),
    });
  }

  // 8. Limites slide
  if (data.limites) {
    slides.push({
      icon: <AlertTriangle className="h-5 w-5" style={{ color: "#b45309" }} />,
      title: "Limites & Reserves",
      content: (
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "#fffbeb",
            borderColor: "#fbbf2440",
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: "#b45309" }} />
            <span className="text-sm font-semibold" style={{ color: "#92400e" }}>
              Points d&apos;attention
            </span>
          </div>
          <div className="space-y-1">
            {data.limites
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed"
                  style={{ color: "#78350f" }}
                >
                  {line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "")}
                </p>
              ))}
          </div>
        </div>
      ),
    });
  }

  return slides;
}

// --- Main component ---

export function AnalysisSlides({
  data,
  query,
}: {
  data: ParsedAnalysis;
  query: string;
}) {
  const slides = buildSlides(data as AnalysisData, query);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const goNext = useCallback(
    () => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1)),
    [slides.length]
  );
  const goPrev = useCallback(
    () => setCurrentSlide((prev) => Math.max(prev - 1, 0)),
    []
  );

  // Global keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Escape") {
        setFullscreen(false);
      }
    }

    if (fullscreen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [fullscreen, goNext, goPrev]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goNext();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
    if (e.key === "Escape") setFullscreen(false);
  };

  if (slides.length === 0) return null;

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background"
    : "relative";

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h2
          className="flex items-center gap-2 text-lg font-bold"
          style={{ color: NAVY }}
        >
          <Scale className="h-4 w-4" style={{ color: GOLD }} />
          Presentation
        </h2>
        <div className="flex items-center gap-3">
          {/* Dot indicators */}
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === currentSlide ? 24 : 8,
                  backgroundColor:
                    i === currentSlide ? NAVY : `${NAVY}25`,
                }}
              />
            ))}
          </div>
          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Slide area */}
      <div
        className={containerClass}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Slide presentation"
        aria-roledescription="carousel"
      >
        <Card
          className={`overflow-hidden ${
            fullscreen
              ? "h-full rounded-none border-0"
              : "h-[500px]"
          }`}
        >
          <SlideShell
            slide={slides[currentSlide]}
            index={currentSlide}
            total={slides.length}
          />
        </Card>

        {/* Left arrow */}
        <div className="absolute inset-y-0 left-2 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/80 shadow-md backdrop-blur"
            onClick={goPrev}
            disabled={currentSlide === 0}
            aria-label="Slide precedente"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Right arrow */}
        <div className="absolute inset-y-0 right-2 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/80 shadow-md backdrop-blur"
            onClick={goNext}
            disabled={currentSlide === slides.length - 1}
            aria-label="Slide suivante"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

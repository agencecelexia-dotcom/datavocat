"use client";

import { useState } from "react";
import { ParsedAnalysis } from "@/lib/parse-analysis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Scale,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(250, 56%, 57%)",
  "hsl(173, 58%, 39%)",
  "hsl(43, 96%, 56%)",
  "hsl(349, 89%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
];

interface Slide {
  title: string;
  emoji: string;
  content: React.ReactNode;
}

interface SlidesProps {
  data: ParsedAnalysis;
  query: string;
}

function SlideShell({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Slide header */}
      <div className="border-b bg-gradient-to-r from-primary/5 to-transparent px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{slide.emoji}</span>
          <h2 className="text-2xl font-bold">{slide.title}</h2>
        </div>
      </div>
      {/* Slide body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">{slide.content}</div>
      {/* Footer */}
      <div className="flex items-center justify-between border-t px-8 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Scale className="h-3.5 w-3.5" />
          Datavocat
        </div>
        <span className="text-xs text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

function buildSlides(data: ParsedAnalysis, query: string): Slide[] {
  const slides: Slide[] = [];

  // Title slide
  slides.push({
    title: "Analyse Jurimetrique",
    emoji: "?",
    content: (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <Scale className="h-16 w-16 text-primary/30" />
        <p className="max-w-lg text-lg text-muted-foreground">{query}</p>
        {data.tauxSuccesGlobal !== null && (
          <div className="mt-4 rounded-2xl bg-primary/10 px-8 py-4">
            <p className="text-sm font-medium text-muted-foreground">
              Taux de succes estime
            </p>
            <p className="text-5xl font-bold text-primary">
              {data.tauxSuccesGlobal}%
            </p>
          </div>
        )}
        {data.echantillon !== null && (
          <p className="text-sm text-muted-foreground">
            Base : {data.echantillon} decisions analysees
          </p>
        )}
      </div>
    ),
  });

  // Situation
  if (data.situation) {
    slides.push({
      title: "Analyse de la situation",
      emoji: "?",
      content: (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {data.situation.split("\n").map((line, i) => {
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return (
                <div key={i} className="flex gap-2 py-1">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "")}</span>
                </div>
              );
            }
            return line.trim() ? (
              <p key={i} className="mb-2">{line.replace(/\*\*/g, "")}</p>
            ) : null;
          })}
        </div>
      ),
    });
  }

  // Arguments chart
  if (data.arguments.length > 0) {
    const chartData = data.arguments.map((a, i) => ({
      name: a.name.length > 25 ? a.name.slice(0, 23) + "..." : a.name,
      taux: a.taux ?? 0,
      fill: COLORS[i % COLORS.length],
    }));

    slides.push({
      title: "Arguments & Taux de succes",
      emoji: "?",
      content: (
        <div className="h-full">
          <div style={{ height: Math.max(220, data.arguments.length * 52) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 10, right: 40 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  fontSize={12}
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Succes"]} />
                <Bar dataKey="taux" radius={[0, 8, 8, 0]} barSize={28}>
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

  // Jurisdictions
  if (data.juridictions.length > 0) {
    const chartData = data.juridictions.map((j, i) => ({
      name: j.name,
      taux: j.taux ?? 0,
      fill: COLORS[i % COLORS.length],
    }));

    slides.push({
      title: "Analyse par juridiction",
      emoji: "?",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="taux"
                  label={({ name, value }) => `${name}: ${value}%`}
                  fontSize={11}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.juridictions.map((j, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{j.name}</span>
                </div>
                <span className="text-sm font-bold">{j.taux ?? "—"}%</span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Montants
  if (data.montants.min !== null || data.montants.max !== null) {
    const fmt = (v: number | null) =>
      v !== null
        ? new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(v)
        : "—";

    slides.push({
      title: "Montants & Indemnites",
      emoji: "?",
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <div className="grid grid-cols-3 gap-8">
            <div className="rounded-2xl border bg-emerald-50 p-6 text-center dark:bg-emerald-950/30">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Minimum
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {fmt(data.montants.min)}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Median
              </p>
              <p className="mt-2 text-3xl font-bold text-primary">
                {fmt(data.montants.median)}
              </p>
            </div>
            <div className="rounded-2xl border bg-rose-50 p-6 text-center dark:bg-rose-950/30">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Maximum
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-400">
                {fmt(data.montants.max)}
              </p>
            </div>
          </div>
          <div className="h-4 w-80 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-rose-400 opacity-70" />
        </div>
      ),
    });
  }

  // Recommandation
  if (data.recommandation) {
    slides.push({
      title: "Recommandation strategique",
      emoji: "?",
      content: (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {data.recommandation.split("\n").map((line, i) => {
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return (
                <div key={i} className="flex gap-2 py-1.5">
                  <span className="mt-1 text-primary">?</span>
                  <span>{line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "")}</span>
                </div>
              );
            }
            if (/^\d+\./.test(line)) {
              return (
                <div key={i} className="flex gap-2 py-1.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {line.match(/^\d+/)?.[0]}
                  </span>
                  <span>{line.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "")}</span>
                </div>
              );
            }
            return line.trim() ? (
              <p key={i} className="mb-2">{line.replace(/\*\*/g, "")}</p>
            ) : null;
          })}
        </div>
      ),
    });
  }

  // Limites
  if (data.limites) {
    slides.push({
      title: "Limites & Reserves",
      emoji: "?",
      content: (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {data.limites.split("\n").map((line, i) =>
              line.trim() ? (
                <p key={i} className="mb-2 text-amber-900 dark:text-amber-200">
                  {line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "")}
                </p>
              ) : null
            )}
          </div>
        </div>
      ),
    });
  }

  return slides;
}

export function AnalysisSlides({ data, query }: SlidesProps) {
  const slides = buildSlides(data, query);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (slides.length === 0) return null;

  const goNext = () =>
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  const goPrev = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") goNext();
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "Escape") setFullscreen(false);
  };

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background"
    : "relative";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Maximize2 className="h-4 w-4 text-primary" />
          Presentation
        </h2>
        <div className="flex items-center gap-2">
          {/* Slide dots */}
          <div className="flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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

      <div
        className={containerClass}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <Card
          className={`overflow-hidden ${fullscreen ? "h-full rounded-none border-0" : "h-[480px]"}`}
        >
          <SlideShell
            slide={slides[currentSlide]}
            index={currentSlide}
            total={slides.length}
          />
        </Card>

        {/* Navigation */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/80 shadow-sm backdrop-blur"
            onClick={goPrev}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/80 shadow-sm backdrop-blur"
            onClick={goNext}
            disabled={currentSlide === slides.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

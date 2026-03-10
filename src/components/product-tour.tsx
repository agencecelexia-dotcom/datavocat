"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useProductTour } from "@/hooks/use-product-tour";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";

interface TooltipPosition {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour() {
  const tour = useProductTour();
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const positionTooltip = useCallback(() => {
    if (!tour.isActive || !tour.step) return;

    const target = document.querySelector(
      `[data-tour="${tour.step.target}"]`
    ) as HTMLElement | null;

    if (!target || tour.step.position === "center") {
      // Center on screen (no spotlight)
      setSpotlight(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 120,
        left: window.innerWidth / 2 - 175,
        placement: "center",
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const pad = 8;

    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // Determine best placement
    const tooltipW = 350;
    const tooltipH = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let placement = tour.step.position || "bottom";
    let top = 0;
    let left = 0;

    // Mobile: always bottom or top
    const isMobile = vw < 640;

    if (isMobile) {
      // On mobile, position below or above element
      if (rect.bottom + tooltipH + 24 < vh) {
        placement = "bottom";
      } else {
        placement = "top";
      }

      if (placement === "bottom") {
        top = rect.bottom + pad + 12;
        left = Math.max(12, Math.min(vw - tooltipW - 12, rect.left + rect.width / 2 - tooltipW / 2));
      } else {
        top = rect.top - pad - tooltipH - 12;
        left = Math.max(12, Math.min(vw - tooltipW - 12, rect.left + rect.width / 2 - tooltipW / 2));
      }
    } else {
      // Desktop: try preferred, then fallback
      if (placement === "right" && rect.right + tooltipW + 24 < vw) {
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + pad + 12;
      } else if (placement === "left" && rect.left - tooltipW - 24 > 0) {
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - pad - tooltipW - 12;
      } else if (rect.bottom + tooltipH + 24 < vh) {
        placement = "bottom";
        top = rect.bottom + pad + 12;
        left = rect.left + rect.width / 2 - tooltipW / 2;
      } else {
        placement = "top";
        top = rect.top - pad - tooltipH - 12;
        left = rect.left + rect.width / 2 - tooltipW / 2;
      }

      // Clamp to viewport
      top = Math.max(12, Math.min(vh - tooltipH - 12, top));
      left = Math.max(12, Math.min(vw - tooltipW - 12, left));
    }

    setTooltipPos({ top, left, placement });
  }, [tour.isActive, tour.step]);

  // Reposition on step change or resize
  useEffect(() => {
    positionTooltip();

    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [positionTooltip, tour.currentStep]);

  if (!mounted || !tour.isActive || !tour.step || !tooltipPos) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* Dark overlay with spotlight cutout */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={tour.skip}
        />
      </svg>

      {/* Spotlight glow ring */}
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[#c9a96e]/50 shadow-lg shadow-[#c9a96e]/20"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 w-[350px] max-w-[calc(100vw-24px)] animate-fade-in-up rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          transition: "top 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Progress bar */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#c9a96e]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Etape {tour.currentStep + 1} / {tour.totalSteps}
            </span>
          </div>
          <button
            onClick={tour.skip}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Fermer le tutoriel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Step progress dots */}
        <div className="flex gap-1 px-4 pt-3">
          {tour.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < tour.currentStep
                  ? "bg-[#2d6a4f]"
                  : i === tour.currentStep
                    ? "bg-[#c9a96e]"
                    : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-4 pt-3 pb-2">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {tour.step.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {tour.step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border/30 px-4 py-3">
          <button
            onClick={tour.skip}
            className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Passer le tutoriel
          </button>
          <div className="flex items-center gap-2">
            {tour.currentStep > 0 && (
              <button
                onClick={tour.prev}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-border/40 bg-background px-3 text-xs font-medium text-foreground transition-all hover:bg-accent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Precedent
              </button>
            )}
            <button
              onClick={tour.next}
              className="flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-[#1e3a5f] px-4 text-xs font-semibold text-white shadow-md shadow-[#1e3a5f]/20 transition-all hover:bg-[#162d4a]"
            >
              {tour.currentStep === tour.totalSteps - 1 ? (
                "Terminer"
              ) : (
                <>
                  Suivant
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

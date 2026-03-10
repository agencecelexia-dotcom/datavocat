"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useProductTour } from "@/hooks/use-product-tour";
import { ChevronLeft, ChevronRight, X, Sparkles, MousePointerClick } from "lucide-react";

interface Pos {
  top: number;
  left: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour() {
  const tour = useProductTour();
  const [tooltipPos, setTooltipPos] = useState<Pos | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipReady, setTooltipReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isInteractive = tour.step?.type === "interact" || tour.step?.type === "wait";

  // Dispatch action event when entering a step
  useEffect(() => {
    if (!tour.isActive || !tour.step?.action) return;
    // Small delay to let the UI settle
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(tour.step!.action!));
    }, 100);
    return () => clearTimeout(timer);
  }, [tour.isActive, tour.currentStep, tour.step]);

  // Watch for waitFor condition — auto-advance when met
  useEffect(() => {
    if (!tour.isActive || !tour.step?.waitFor) return;

    const check = () => !!document.querySelector(tour.step!.waitFor!);

    // Already met?
    if (check()) {
      const timer = setTimeout(() => tour.next(), 300);
      return () => clearTimeout(timer);
    }

    // Observe DOM changes
    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
        // Small delay for smooth transition
        setTimeout(() => tour.next(), 300);
      }
    });
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    // Fallback polling (in case MutationObserver misses attribute changes)
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        observer.disconnect();
        setTimeout(() => tour.next(), 300);
      }
    }, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.currentStep]);

  // Measure tooltip then position
  const reposition = useCallback(() => {
    if (!tour.isActive || !tour.step) return;

    const tooltip = tooltipRef.current;
    const tooltipW = tooltip?.offsetWidth || 350;
    const tooltipH = tooltip?.offsetHeight || 260;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const gap = 14;

    const target = document.querySelector(
      `[data-tour="${tour.step.target}"]`
    ) as HTMLElement | null;

    // Interactive/wait steps: dock to bottom-right (desktop) or bottom-center (mobile)
    // so the tooltip doesn't block page interaction
    if (isInteractive && (!target || tour.step.position === "center")) {
      setSpotlight(null);
      const isMobile = vw < 768;
      setTooltipPos({
        top: vh - tooltipH - 16,
        left: isMobile
          ? Math.max(8, (vw - tooltipW) / 2)
          : Math.max(10, vw - tooltipW - 20),
      });
      setTooltipReady(true);
      return;
    }

    // No target or center step (info only)
    if (!target || tour.step.position === "center") {
      setSpotlight(null);
      setTooltipPos({
        top: Math.max(20, (vh - tooltipH) / 2),
        left: Math.max(12, (vw - tooltipW) / 2),
      });
      setTooltipReady(true);
      return;
    }

    // Scroll target into view if needed
    const rect = target.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > vh) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(reposition, 350);
      return;
    }

    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    let top = 0;
    let left = 0;
    const isMobile = vw < 768;

    if (isMobile) {
      if (rect.top - tooltipH - gap > 10) {
        top = rect.top - pad - tooltipH - gap;
      } else {
        top = rect.bottom + pad + gap;
      }
      left = Math.max(8, Math.min(vw - tooltipW - 8, (vw - tooltipW) / 2));
    } else {
      const pref = tour.step.position || "bottom";

      if (pref === "right" && rect.right + tooltipW + gap + pad < vw) {
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + pad + gap;
      } else if (pref === "left" && rect.left - tooltipW - gap - pad > 0) {
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - pad - tooltipW - gap;
      } else if (rect.top - tooltipH - gap > 10) {
        top = rect.top - pad - tooltipH - gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
      } else {
        top = rect.bottom + pad + gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
      }

      top = Math.max(10, Math.min(vh - tooltipH - 10, top));
      left = Math.max(10, Math.min(vw - tooltipW - 10, left));
    }

    setTooltipPos({ top, left });
    setTooltipReady(true);
  }, [tour.isActive, tour.step, isInteractive]);

  // Position after render so we can measure tooltip
  useLayoutEffect(() => {
    if (!tour.isActive) {
      setTooltipReady(false);
      return;
    }
    setTooltipReady(false);
    const frame = requestAnimationFrame(() => {
      reposition();
    });
    return () => cancelAnimationFrame(frame);
  }, [tour.isActive, tour.currentStep, reposition]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!tour.isActive) return;
    const handle = () => reposition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [tour.isActive, reposition]);

  // Poll reposition for interact/wait steps — target may appear after step starts
  useEffect(() => {
    if (!tour.isActive || !isInteractive) return;
    const interval = setInterval(() => reposition(), 600);
    return () => clearInterval(interval);
  }, [tour.isActive, tour.currentStep, isInteractive, reposition]);

  if (!mounted || !tour.isActive || !tour.step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" style={{ pointerEvents: isInteractive ? "none" : undefined }}>
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={12}
                fill="black"
                style={{ transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={isInteractive ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.55)"}
          mask="url(#tour-mask)"
          style={{ pointerEvents: isInteractive ? "none" : "auto" }}
          onClick={isInteractive ? undefined : tour.skip}
        />
      </svg>

      {/* Spotlight glow */}
      {spotlight && tooltipReady && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[#c9a96e]/40 shadow-lg shadow-[#c9a96e]/20"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 w-[340px] max-w-[calc(100vw-16px)] rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20"
        style={{
          top: tooltipReady && tooltipPos ? tooltipPos.top : -9999,
          left: tooltipReady && tooltipPos ? tooltipPos.left : -9999,
          opacity: tooltipReady ? 1 : 0,
          pointerEvents: "auto",
          transition: tooltipReady
            ? "top 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s"
            : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#c9a96e]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Etape {tour.currentStep + 1} / {tour.totalSteps}
            </span>
          </div>
          <button
            onClick={tour.skip}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress segments */}
        <div className="flex gap-1 px-4 pt-2.5">
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
        <div className="px-4 pt-2.5 pb-1.5">
          <h3 className="font-serif text-base font-semibold text-foreground">
            {tour.step.title}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {tour.step.description}
          </p>
          {/* Interaction hint for interact steps */}
          {tour.step.type === "interact" && tour.step.hideNext && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#c9a96e]">
              <MousePointerClick className="h-3.5 w-3.5" />
              Interagissez avec la page pour continuer
            </div>
          )}
          {tour.step.type === "wait" && tour.step.hideNext && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#c9a96e]">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#c9a96e]/30 border-t-[#c9a96e]" />
              En attente...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
          <button
            onClick={tour.skip}
            className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Passer le tutoriel
          </button>
          <div className="flex items-center gap-2">
            {tour.currentStep > 0 && !tour.step.hideNext && (
              <button
                onClick={tour.prev}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-border/40 bg-background px-2.5 text-xs font-medium text-foreground transition-all hover:bg-accent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Retour
              </button>
            )}
            {!tour.step.hideNext && (
              <button
                onClick={tour.next}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-[#1e3a5f] px-3.5 text-xs font-semibold text-white shadow-md shadow-[#1e3a5f]/20 transition-all hover:bg-[#162d4a]"
              >
                {tour.step.buttonLabel ? (
                  tour.step.buttonLabel
                ) : tour.currentStep === tour.totalSteps - 1 ? (
                  "Terminer"
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

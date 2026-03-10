"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useProductTour } from "@/hooks/use-product-tour";
import { X, Sparkles, MousePointerClick, Loader2 } from "lucide-react";

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
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isButtonStep = tour.step?.showButton === true;
  const noOverlay = tour.step?.noOverlay === true;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dispatch action event when entering a step
  useEffect(() => {
    if (!tour.isActive || !tour.step?.action) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(tour.step!.action!));
    }, 100);
    return () => clearTimeout(timer);
  }, [tour.isActive, tour.currentStep, tour.step]);

  // Watch for waitFor condition — auto-advance
  useEffect(() => {
    if (!tour.isActive || !tour.step?.waitFor) return;

    let cancelled = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const advance = () => {
      if (cancelled) return;
      cancelled = true;
      observer.disconnect();
      clearInterval(interval);
      pendingTimer = setTimeout(() => {
        if (!cancelled) return; // extra guard — should always be true
        tour.next();
      }, 300);
    };

    const check = () => !!document.querySelector(tour.step!.waitFor!);
    if (check()) {
      // Already met — schedule advance and return cleanup
      const timer = setTimeout(() => {
        if (!cancelled) tour.next();
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const observer = new MutationObserver(() => {
      if (check()) advance();
    });
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    const interval = setInterval(() => {
      if (check()) advance();
    }, 500);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearInterval(interval);
      if (pendingTimer !== null) clearTimeout(pendingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.currentStep]);

  // Click on target element → advance tour (for steps without waitFor)
  useEffect(() => {
    if (!tour.isActive || !tour.step || tour.step.showButton || tour.step.waitFor) return;

    const target = document.querySelector(
      `[data-tour="${tour.step.target}"]`
    ) as HTMLElement | null;
    if (!target) return;

    let clicked = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      if (clicked) return; // guard against rapid double-clicks
      clicked = true;
      timer = setTimeout(() => tour.next(), 400);
    };
    target.addEventListener("click", handler);
    return () => {
      target.removeEventListener("click", handler);
      if (timer !== null) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.currentStep]);

  // Measure tooltip then position
  const reposition = useCallback(() => {
    if (!tour.isActive || !tour.step) return;

    const tooltip = tooltipRef.current;
    const tooltipW = tooltip?.offsetWidth || 350;
    const tooltipH = tooltip?.offsetHeight || 220;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 10;
    const gap = 14;

    const target = document.querySelector(
      `[data-tour="${tour.step.target}"]`
    ) as HTMLElement | null;

    // No target or center step → center tooltip
    if (!target || tour.step.position === "center") {
      setSpotlight(null);
      setTooltipPos({
        top: Math.max(20, (vh - tooltipH) / 2),
        left: Math.max(12, (vw - tooltipW) / 2),
      });
      setTooltipReady(true);
      return;
    }

    const rect = target.getBoundingClientRect();

    // Target is invisible (display:none, zero-size) — treat like no target
    if (rect.width === 0 && rect.height === 0) {
      setSpotlight(null);
      setTooltipPos({
        top: Math.max(20, (vh - tooltipH) / 2),
        left: Math.max(12, (vw - tooltipW) / 2),
      });
      setTooltipReady(true);
      return;
    }

    if (rect.top < 0 || rect.bottom > vh) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (scrollTimerRef.current !== null) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(reposition, 350);
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
      top = Math.max(10, Math.min(vh - tooltipH - 10, top));
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
  }, [tour.isActive, tour.step]);

  useLayoutEffect(() => {
    if (!tour.isActive) {
      setTooltipReady(false);
      return;
    }
    setTooltipReady(false);
    const frame = requestAnimationFrame(() => reposition());
    return () => {
      cancelAnimationFrame(frame);
      // Clean up any pending scrollIntoView reposition timer
      if (scrollTimerRef.current !== null) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [tour.isActive, tour.currentStep, reposition]);

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

  // Poll reposition — target may appear after step starts
  useEffect(() => {
    if (!tour.isActive) return;
    const interval = setInterval(() => reposition(), 600);
    return () => clearInterval(interval);
  }, [tour.isActive, tour.currentStep, reposition]);

  // Dim sidebar + header during noOverlay steps to focus user on main content
  useEffect(() => {
    if (!tour.isActive || !noOverlay) return;
    const sidebar = document.querySelector('[data-tour="sidebar"]') as HTMLElement | null;
    const header = document.querySelector('header') as HTMLElement | null;
    if (sidebar) {
      sidebar.style.opacity = '0.3';
      sidebar.style.pointerEvents = 'none';
      sidebar.style.transition = 'opacity 0.3s ease';
    }
    if (header) {
      header.style.opacity = '0.3';
      header.style.pointerEvents = 'none';
      header.style.transition = 'opacity 0.3s ease';
    }
    return () => {
      if (sidebar) { sidebar.style.opacity = ''; sidebar.style.pointerEvents = ''; sidebar.style.transition = ''; }
      if (header) { header.style.opacity = ''; header.style.pointerEvents = ''; header.style.transition = ''; }
    };
  }, [tour.isActive, tour.currentStep, noOverlay]);

  if (!mounted || !tour.isActive || !tour.step) return null;

  return createPortal(
    <div
      className="fixed z-[9999]"
      role="dialog"
      aria-modal={isButtonStep}
      style={
        isButtonStep
          ? { inset: 0 }
          : { top: 0, left: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none" }
      }
    >
      {/* Dark overlay with spotlight cutout — uses box-shadow instead of SVG
          to avoid blocking scroll/touch events on interactive steps.
          noOverlay steps: no dimming at all, just spotlight ring + tooltip */}
      {noOverlay ? (
        spotlight && tooltipReady && (
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-[#c9a96e]"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              animation: "pulse-ring-no-overlay 2s ease-in-out infinite",
            }}
          />
        )
      ) : spotlight && tooltipReady ? (
        <div
          className="fixed rounded-xl ring-2 ring-[#c9a96e]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 0 rgba(201,169,110,0.4)",
            pointerEvents: isButtonStep ? "auto" : "none",
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            animation: "pulse-ring 2s ease-in-out infinite",
          }}
          onClick={isButtonStep ? tour.skip : undefined}
        />
      ) : (
        /* No spotlight — full dark overlay (center/welcome steps) */
        <div
          className="fixed inset-0"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            pointerEvents: isButtonStep ? "auto" : "none",
          }}
          onClick={isButtonStep ? tour.skip : undefined}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-10 w-[320px] max-w-[calc(100vw-16px)] rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20"
        style={{
          top: tooltipReady && tooltipPos ? tooltipPos.top : -9999,
          left: tooltipReady && tooltipPos ? tooltipPos.left : -9999,
          opacity: tooltipReady ? 1 : 0,
          pointerEvents: "auto",
          transition: tooltipReady
            ? "top 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s"
            : "none",
        }}
        onWheel={(e) => {
          // Pass scroll through to main content so tooltip doesn't block scrolling
          const main = document.querySelector("main");
          if (main) {
            main.scrollTop += e.deltaY;
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#c9a96e]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tour.currentStep + 1} / {tour.totalSteps}
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

        {/* Progress */}
        <div className="flex gap-0.5 px-4">
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
        <div className="px-4 pt-2 pb-3">
          <h3 className="font-serif text-[15px] font-semibold text-foreground">
            {tour.step.title}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {tour.step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
          <button
            onClick={tour.skip}
            className="cursor-pointer text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            Quitter
          </button>
          {tour.step.showButton ? (
            <button
              onClick={tour.next}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 text-xs font-semibold text-white shadow-md shadow-[#1e3a5f]/20 transition-all hover:bg-[#162d4a]"
            >
              {tour.step.buttonLabel || "Suivant"}
            </button>
          ) : tour.step.waitHint ? (
            <span className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {tour.step.waitHint}
            </span>
          ) : (
            <span className="flex h-8 items-center gap-1.5 text-xs font-medium text-[#c9a96e]">
              <MousePointerClick className="h-3.5 w-3.5" />
              Cliquez sur l&apos;element en surbrillance
            </span>
          )}
        </div>
      </div>

      {/* Pulse animations */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 0 rgba(201,169,110,0.4); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 6px rgba(201,169,110,0); }
        }
        @keyframes pulse-ring-no-overlay {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,169,110,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(201,169,110,0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

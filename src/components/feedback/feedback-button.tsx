"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, X, Loader2 } from "lucide-react";

const CATEGORIES = [
  "Bug",
  "Suggestion",
  "Amélioration UX",
  "Idée de fonctionnalité",
  "Autre",
];

/**
 * Bouton flottant en bas à droite qui ouvre un modal pour envoyer un feedback
 * à contact@datavocat.fr. Présent sur toutes les pages de l'app connectée.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Fermer avec Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    const loadingId = toast.loading("Envoi du message…");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `${res.status}` }));
        toast.error(err.error || "Envoi impossible", { id: loadingId });
        return;
      }
      toast.success("Message envoyé — merci pour votre retour !", { id: loadingId });
      setMessage("");
      setOpen(false);
    } catch {
      toast.error("Erreur réseau. Réessayez plus tard.", { id: loadingId });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Envoyer un feedback"
        title="Suggérer une modification"
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
        style={{
          background: "var(--ink)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(11, 18, 32, 0.18)",
        }}
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(11, 18, 32, 0.35)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[520px] rounded-lg overflow-hidden animate-fade-in-up"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              boxShadow: "0 20px 60px rgba(11, 18, 32, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: "1px solid var(--line-soft)" }}
            >
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1.5"
                  style={{ color: "var(--gold)" }}
                >
                  § Votre retour
                </div>
                <h2 className="font-serif text-[22px] font-medium tracking-tight">
                  Suggérer une <span className="dv-italic">amélioration.</span>
                </h2>
                <p
                  className="mt-1.5 text-[12.5px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Le message part sur{" "}
                  <span style={{ color: "var(--ink)" }}>contact@datavocat.fr</span>.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md cursor-pointer"
                style={{ color: "var(--muted-foreground)" }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Catégories */}
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  01 · Type de message
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const active = category === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCategory(c)}
                        className="px-3 py-1.5 text-[12px] rounded-full cursor-pointer transition-colors"
                        style={{
                          background: active ? "var(--ink)" : "transparent",
                          color: active ? "#fff" : "var(--muted-foreground)",
                          border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  02 · Votre message
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Décrivez votre suggestion, signalez un bug, partagez une idée…"
                  rows={6}
                  maxLength={5000}
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 text-[13.5px] leading-relaxed bg-transparent outline-none resize-none rounded-md"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                  }}
                />
                <div
                  className="mt-1 font-mono text-[10px] tabular-nums text-right"
                  style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
                >
                  {message.length} / 5000
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-between pt-3"
                style={{ borderTop: "1px solid var(--line-soft)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[12.5px] underline underline-offset-4 cursor-pointer"
                  style={{
                    color: "var(--muted-foreground)",
                    textDecorationColor: "var(--line)",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-white rounded-md cursor-pointer disabled:opacity-40"
                  style={{ background: "var(--ink)" }}
                >
                  {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Envoyer le message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

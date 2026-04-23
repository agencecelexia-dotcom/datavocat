"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Clock } from "lucide-react";

interface AdminUser {
  id: string;
  email: string | null;
  fullName: string;
  cabinetName: string;
  createdAt: string;
  lastSignIn: string | null;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/list-pending");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      toast.error("Impossible de charger les utilisateurs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setApproved = async (userId: string, approved: boolean) => {
    setPending(userId);
    const loadingId = toast.loading(approved ? "Validation…" : "Révocation…");
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approved }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `${res.status}` }));
        toast.error(err.error || "Erreur", { id: loadingId });
        return;
      }
      toast.success(approved ? "Compte validé" : "Compte révoqué", { id: loadingId });
      await load();
    } catch (err) {
      toast.error("Erreur réseau", { id: loadingId });
      console.error(err);
    } finally {
      setPending(null);
    }
  };

  const filtered = users.filter((u) => {
    if (filter === "pending") return !u.approved;
    if (filter === "approved") return u.approved;
    return true;
  });

  const countPending = users.filter((u) => !u.approved).length;
  const countApproved = users.filter((u) => u.approved).length;

  return (
    <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
      <div className="flex items-center gap-3 mb-6">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: "var(--gold)" }}
        >
          § Validation des comptes
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <button
          onClick={load}
          className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] cursor-pointer"
          style={{ color: "var(--muted-foreground)" }}
        >
          <RefreshCw className="h-3 w-3" />
          Rafraîchir
        </button>
      </div>

      <h1 className="font-serif text-[36px] font-medium tracking-tight mb-3">
        Demandes <span className="dv-italic">en attente.</span>
      </h1>
      <p className="text-[14px] mb-8" style={{ color: "var(--muted-foreground)" }}>
        Validez ou révoquez l&apos;accès des utilisateurs inscrits.
      </p>

      {/* Filtres */}
      <div
        className="flex items-center gap-1 mb-6"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {[
          { key: "pending" as const, label: "En attente", count: countPending },
          { key: "approved" as const, label: "Validés", count: countApproved },
          { key: "all" as const, label: "Tous", count: users.length },
        ].map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="px-3 py-2.5 text-[13px] cursor-pointer transition-all"
              style={{
                color: active ? "var(--ink)" : "var(--muted-foreground)",
                fontWeight: active ? 500 : 400,
                borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            >
              {t.label}
              <span className="ml-1 font-mono tabular-nums" style={{ opacity: 0.6 }}>
                ({t.count})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center rounded-md"
          style={{ border: "1px dashed var(--line)" }}
        >
          <Clock className="h-8 w-8 mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
          <p className="font-serif text-[18px]" style={{ color: "var(--ink)" }}>
            {filter === "pending" ? "Aucune demande en attente" : "Aucun utilisateur"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="p-5 rounded-md"
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
                borderLeft: `3px solid ${u.approved ? "var(--emerald, #2d6a4f)" : "var(--gold)"}`,
              }}
            >
              <div className="flex items-start gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="font-serif text-[17px] font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {u.fullName || "—"}
                    </div>
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded"
                      style={{
                        color: u.approved ? "var(--emerald, #2d6a4f)" : "var(--gold)",
                        background: "color-mix(in srgb, currentColor 10%, transparent)",
                      }}
                    >
                      {u.approved ? "Validé" : "En attente"}
                    </span>
                  </div>
                  <div
                    className="font-mono text-[11.5px] mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {u.email}
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {u.cabinetName && (
                      <span>
                        <strong style={{ color: "var(--ink)" }}>{u.cabinetName}</strong>
                      </span>
                    )}
                    <span>
                      Demande : <span className="tabular-nums">{formatDate(u.createdAt)}</span>
                    </span>
                    {u.lastSignIn && (
                      <span>
                        Dernière connexion :{" "}
                        <span className="tabular-nums">{formatDate(u.lastSignIn)}</span>
                      </span>
                    )}
                    {u.approvedAt && (
                      <span>
                        Validé le <span className="tabular-nums">{formatDate(u.approvedAt)}</span>
                        {u.approvedBy && ` par ${u.approvedBy}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {u.approved ? (
                    <button
                      onClick={() => setApproved(u.id, false)}
                      disabled={pending === u.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium rounded-md cursor-pointer disabled:opacity-40"
                      style={{
                        border: "1px solid color-mix(in srgb, var(--bordeaux, #9b2226) 40%, transparent)",
                        color: "var(--bordeaux, #9b2226)",
                      }}
                    >
                      {pending === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      Révoquer
                    </button>
                  ) : (
                    <button
                      onClick={() => setApproved(u.id, true)}
                      disabled={pending === u.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-white rounded-md cursor-pointer disabled:opacity-40"
                      style={{ background: "var(--emerald, #2d6a4f)" }}
                    >
                      {pending === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Valider l&apos;accès
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

type ExtractionStatus = "pending" | "extracting" | "review" | "validated" | "error";

export function useExtractionStatus(decisionId: string | null) {
  const [status, setStatus] = useState<ExtractionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const poll = useCallback(async () => {
    if (!decisionId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/decisions/${decisionId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useEffect(() => {
    if (!decisionId) return;

    poll();

    const interval = setInterval(() => {
      if (status === "pending" || status === "extracting") {
        poll();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [decisionId, status, poll]);

  return { status, loading };
}

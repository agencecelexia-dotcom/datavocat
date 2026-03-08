"use client";

import { useState, useCallback } from "react";
import { ClipboardCopy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

const MOIS_FR = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

function formatFrenchDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

interface CopyReferenceProps {
  ecli?: string;
  pourvoi?: string;
  juridiction?: string;
  date?: string;
  chambre?: string;
  className?: string;
}

export function CopyReference({
  ecli,
  pourvoi,
  juridiction,
  date,
  chambre,
  className,
}: CopyReferenceProps) {
  const [copied, setCopied] = useState(false);

  const buildCitation = useCallback(() => {
    const parts: string[] = [];

    // Build the short-form citation: "Cass. soc., 15 mars 2023, n. 21-12.345"
    if (juridiction) {
      parts.push(juridiction);
    }
    if (chambre) {
      parts.push(chambre);
    }
    if (date) {
      parts.push(formatFrenchDate(date));
    }
    if (pourvoi) {
      parts.push(`n. ${pourvoi}`);
    }

    let citation = parts.length > 0 ? parts.join(", ") : ecli || "";

    if (ecli) {
      citation += `\n${ecli}`;
    }

    return citation.trim();
  }, [ecli, pourvoi, juridiction, date, chambre]);

  const handleCopy = useCallback(async () => {
    const text = buildCitation();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [buildCitation]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          onClick={handleCopy}
          className={`inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-[#1e3a5f]/10 hover:text-[#1e3a5f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
          aria-label="Copier la reference"
        >
          {copied ? (
            <Check className="size-3.5 text-[#2d6a4f]" />
          ) : (
            <ClipboardCopy className="size-3.5" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {copied ? "Copie !" : "Copier la reference"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

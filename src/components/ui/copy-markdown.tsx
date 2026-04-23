"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CopyMarkdownProps {
  content: string;
  className?: string;
}

export function CopyMarkdown({ content, className }: CopyMarkdownProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] rounded-md cursor-pointer transition-colors ${className ?? ""}`}
      style={{
        border: "1px solid var(--line)",
        color: copied ? "var(--emerald, #2d6a4f)" : "var(--muted-foreground)",
      }}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copié !
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copier
        </>
      )}
    </button>
  );
}

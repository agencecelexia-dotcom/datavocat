"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, Loader2, ChevronDown } from "lucide-react";
import { formatMarkdownSafe } from "@/lib/format-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnalysisChatProps {
  analysisContext: string;
  query: string;
}

const MAX_MESSAGES = 20;

export function AnalysisChat({ analysisContext, query }: AnalysisChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // suppress unused var warning — query available for future use
  void query;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || messages.length >= MAX_MESSAGES) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          analysisContext,
        }),
      });

      if (!res.ok) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "La réponse a échoué. Veuillez réessayer.",
          },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setMessages([
            ...newMessages,
            { role: "assistant", content: text },
          ]);
        }
      }
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Erreur de connexion. Vérifiez votre connexion internet.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messageCount = messages.filter((m) => m.role === "user").length;

  return (
    <div>
      {/* Collapsed header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors cursor-pointer"
      >
        <MessageCircle className="h-4 w-4" style={{ color: "var(--gold)" }} />
        <div className="flex-1">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--gold)" }}
          >
            § Poser une question de suivi
          </div>
          <div
            className="font-serif text-[16px] font-medium mt-0.5"
            style={{ color: "var(--ink)" }}
          >
            Approfondir <span className="dv-italic">l&apos;analyse.</span>
          </div>
        </div>
        {messageCount > 0 && (
          <span
            className="font-mono text-[10px] tabular-nums px-2 py-0.5 rounded"
            style={{
              background: "color-mix(in srgb, var(--gold) 12%, transparent)",
              color: "var(--gold)",
            }}
          >
            {messageCount}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          style={{ color: "var(--muted-foreground)" }}
        />
      </button>

      {/* Expanded chat */}
      {isOpen && (
        <div
          className="mt-4 rounded-md overflow-hidden"
          style={{
            border: "1px solid var(--line)",
            background: "var(--card)",
          }}
        >
          {/* Messages list */}
          {messages.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="px-4 py-2.5 max-w-[85%] text-[13px] leading-relaxed"
                    style={
                      msg.role === "user"
                        ? {
                            background: "var(--ink)",
                            color: "#fff",
                            borderRadius: "14px 14px 4px 14px",
                          }
                        : {
                            background: "var(--paper)",
                            color: "var(--ink)",
                            border: "1px solid var(--line-soft)",
                            borderRadius: "14px 14px 14px 4px",
                          }
                    }
                  >
                    {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]"
                          style={{ background: "currentColor" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]"
                          style={{ background: "currentColor" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]"
                          style={{ background: "currentColor" }}
                        />
                      </span>
                    ) : msg.role === "user" ? (
                      <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                    ) : (
                      <div
                        className="prose-chat"
                        dangerouslySetInnerHTML={{ __html: formatMarkdownSafe(msg.content) }}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input bar */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderTop: "1px solid var(--line-soft)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length >= MAX_MESSAGES
                  ? "Limite de messages atteinte"
                  : "Votre question…"
              }
              disabled={isStreaming || messages.length >= MAX_MESSAGES}
              className="flex-1 px-3 py-2 text-[13px] bg-transparent outline-none rounded-md"
              style={{
                border: "1px solid var(--line)",
                background: "var(--bg)",
                color: "var(--ink)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={
                !input.trim() || isStreaming || messages.length >= MAX_MESSAGES
              }
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-white cursor-pointer disabled:opacity-40"
              style={{ background: "var(--ink)" }}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


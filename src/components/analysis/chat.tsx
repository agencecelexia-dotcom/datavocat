"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Loader2, ChevronDown } from "lucide-react";

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
            content: "Erreur lors de la reponse. Veuillez reessayer.",
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
    <div className="border-t border-border/60">
      {/* Collapsed header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <MessageCircle className="h-4 w-4 text-gold" />
        <span className="text-sm font-medium">
          Poser une question de suivi
        </span>
        {messageCount > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {messageCount}
          </span>
        )}
        <div className="flex-1" />
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded chat */}
      {isOpen && (
        <div className="flex flex-col border-t border-border/40">
          {/* Messages list */}
          {messages.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] ml-auto text-sm"
                        : "bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm"
                    }
                  >
                    {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                      </span>
                    ) : (
                      <ChatContent content={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-border/40 px-4 py-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length >= MAX_MESSAGES
                  ? "Limite de messages atteinte"
                  : "Votre question..."
              }
              disabled={isStreaming || messages.length >= MAX_MESSAGES}
              className="flex-1 text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || messages.length >= MAX_MESSAGES}
              className="shrink-0 bg-gold hover:bg-gold/90"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders chat message content with simple inline formatting (no dangerouslySetInnerHTML). */
function ChatContent({ content }: { content: string }) {
  // Split content into segments: bold, ECLI links, and plain text
  const parts = parseContent(content);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.type === "bold") {
          return <strong key={i}>{part.text}</strong>;
        }
        if (part.type === "ecli") {
          return (
            <a
              key={i}
              href={`https://www.legifrance.gouv.fr/search/juri?query=${part.text}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary font-mono text-xs"
            >
              {part.text}
            </a>
          );
        }
        if (part.type === "listItem") {
          return (
            <span key={i} className="block pl-3">
              {part.text}
            </span>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </span>
  );
}

interface ContentPart {
  type: "text" | "bold" | "ecli" | "listItem";
  text: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];

  // Combined regex for bold, ECLI references, and list items
  const regex = /(\*\*(.+?)\*\*)|(ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+)|(^- .+$)/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Bold
      parts.push({ type: "bold", text: match[2] });
    } else if (match[3]) {
      // ECLI
      parts.push({ type: "ecli", text: match[3] });
    } else if (match[4]) {
      // List item
      parts.push({ type: "listItem", text: match[4] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: "text", text: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: content }];
}

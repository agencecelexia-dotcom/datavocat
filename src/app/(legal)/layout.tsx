import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={24} tone="light" />
            <span
              className="font-serif text-[16px] font-medium"
              style={{ letterSpacing: "-0.01em" }}
            >
              Datavocat
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-[780px] px-6 lg:px-10 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--line)" }}>
        <div
          className="mx-auto flex max-w-[780px] flex-wrap items-center justify-center gap-4 px-6 py-6 font-mono text-[10.5px] uppercase tracking-[0.12em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>Datavocat © {new Date().getFullYear()}</span>
          <span className="h-3 w-px" style={{ background: "var(--line)" }} />
          <Link
            href="/mentions-legales"
            className="transition-colors hover:text-[color:var(--ink)]"
          >
            Mentions légales
          </Link>
          <span className="h-3 w-px" style={{ background: "var(--line)" }} />
          <Link
            href="/cgu"
            className="transition-colors hover:text-[color:var(--ink)]"
          >
            CGU
          </Link>
          <span className="h-3 w-px" style={{ background: "var(--line)" }} />
          <Link
            href="/confidentialite"
            className="transition-colors hover:text-[color:var(--ink)]"
          >
            Confidentialité
          </Link>
        </div>
      </footer>
    </div>
  );
}

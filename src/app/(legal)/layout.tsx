import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-[#1e3a5f]" />
            <span className="font-serif text-lg text-[#1e3a5f]">
              Datavocat
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-6 px-6 py-6 text-xs text-muted-foreground">
          <span>Datavocat &copy; {new Date().getFullYear()}</span>
          <span className="h-3 w-px bg-border" />
          <Link
            href="/mentions-legales"
            className="hover:text-foreground transition-colors"
          >
            Mentions légales
          </Link>
          <span className="h-3 w-px bg-border" />
          <Link
            href="/cgu"
            className="hover:text-foreground transition-colors"
          >
            CGU
          </Link>
          <span className="h-3 w-px bg-border" />
          <Link
            href="/confidentialite"
            className="hover:text-foreground transition-colors"
          >
            Confidentialité
          </Link>
        </div>
      </footer>
    </div>
  );
}

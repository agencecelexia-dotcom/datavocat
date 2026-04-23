import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./signout-button";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? null;
  const name = (user?.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Header minimal */}
      <header
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} tone="light" />
            <span
              className="font-serif text-[16px] font-medium"
              style={{ letterSpacing: "-0.01em" }}
            >
              Datavocat
            </span>
          </div>
          {email && <SignOutButton />}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[560px]">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: "var(--gold)" }}
          >
            § En attente de validation
          </div>

          <h1 className="font-serif text-[40px] leading-[1.05] font-medium tracking-tight">
            Votre demande est <span className="dv-italic">à l&apos;étude.</span>
          </h1>

          <p
            className="mt-5 text-[14.5px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {name ? (
              <>Merci <strong style={{ color: "var(--ink)" }}>{name}</strong>, votre inscription a bien été enregistrée.</>
            ) : (
              <>Votre inscription a bien été enregistrée.</>
            )}
            {" "}Datavocat est actuellement réservé à une liste fermée de
            cabinets partenaires. Un administrateur va examiner votre demande
            manuellement.
          </p>

          <div
            className="mt-8 pl-4"
            style={{ borderLeft: "2px solid var(--gold)" }}
          >
            <div
              className="font-mono text-[10px] uppercase tracking-[0.18em] mb-1.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              Prochaine étape
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
              Vous recevrez un email sur <strong>{email || "votre adresse"}</strong> dès que votre compte sera validé — généralement sous 24 à 48 h ouvrées.
            </p>
          </div>

          <div
            className="mt-10 pt-6 flex flex-wrap items-center justify-between gap-4"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <div
              className="text-[11.5px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Une question ? Écrivez-nous à{" "}
              <a
                href="mailto:contact@datavocat.fr"
                className="underline underline-offset-2"
                style={{ color: "var(--ink)", textDecorationColor: "var(--gold)" }}
              >
                contact@datavocat.fr
              </a>
            </div>
            <Link
              href="/"
              className="font-mono text-[10.5px] uppercase tracking-[0.15em] underline underline-offset-4"
              style={{ color: "var(--muted-foreground)", textDecorationColor: "var(--line)" }}
            >
              Vérifier à nouveau
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div
          className="mx-auto flex max-w-[780px] flex-wrap items-center justify-center gap-4 px-6 py-6 font-mono text-[10.5px] uppercase tracking-[0.12em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>Datavocat © 2026</span>
          <span className="h-3 w-px" style={{ background: "var(--line)" }} />
          <Link href="/cgu" className="transition-colors hover:text-[color:var(--ink)]">CGU</Link>
          <span className="h-3 w-px" style={{ background: "var(--line)" }} />
          <Link href="/confidentialite" className="transition-colors hover:text-[color:var(--ink)]">Confidentialité</Link>
        </div>
      </footer>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9]">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="h-px w-12 bg-[#c9a96e]/40" />
        <p className="text-xs text-[#0f172a]/40 tracking-wide">
          Datavocat — Analyse Jurimetrique
        </p>
      </div>
    </div>
  );
}

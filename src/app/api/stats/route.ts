import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const type = request.nextUrl.searchParams.get("type") || "global";

  // Scope filter key/value for decisions
  const scopeKey = auth.cabinetId ? "cabinet_id" : "uploaded_by";
  const scopeVal = auth.cabinetId || auth.userId;

  switch (type) {
    case "global": {
      const { data: decisions } = await supabase
        .from("decisions")
        .select("id, resultat, delai_statuer_mois, montant_condamnations")
        .eq("status", "validated")
        .eq(scopeKey, scopeVal as string);

      if (!decisions || decisions.length === 0) {
        return NextResponse.json({
          total_decisions: 0,
          taux_annulation: null,
          delai_moyen_mois: null,
          montant_moyen: null,
        });
      }

      const total = decisions.length;
      const annulations = decisions.filter(
        (d) => d.resultat === "annulation"
      ).length;
      const delais = decisions
        .map((d) => d.delai_statuer_mois)
        .filter((d): d is number => d !== null);
      const montants = decisions
        .map((d) => d.montant_condamnations)
        .filter((m): m is number => m !== null);

      return NextResponse.json({
        total_decisions: total,
        taux_annulation:
          total > 0 ? Math.round((annulations / total) * 1000) / 10 : null,
        delai_moyen_mois:
          delais.length > 0
            ? Math.round(
                (delais.reduce((a, b) => a + b, 0) / delais.length) * 10
              ) / 10
            : null,
        montant_moyen:
          montants.length > 0
            ? Math.round(
                montants.reduce((a, b) => a + b, 0) / montants.length
              )
            : null,
      });
    }

    case "juridiction": {
      const { data: decisions } = await supabase
        .from("decisions")
        .select("juridiction_type, juridiction_ville, resultat")
        .eq("status", "validated")
        .eq(scopeKey, scopeVal);

      if (!decisions || decisions.length === 0) {
        return NextResponse.json([]);
      }

      // Aggregate by juridiction
      const map = new Map<string, { total: number; annulations: number; ville: string | null; type: string | null }>();
      for (const d of decisions) {
        const key = `${d.juridiction_type || ""}|${d.juridiction_ville || ""}`;
        const entry = map.get(key) || { total: 0, annulations: 0, ville: d.juridiction_ville, type: d.juridiction_type };
        entry.total++;
        if (d.resultat === "annulation") entry.annulations++;
        map.set(key, entry);
      }

      const result = Array.from(map.values()).map((e) => ({
        juridiction_type: e.type,
        juridiction_ville: e.ville,
        total_decisions: e.total,
        taux_annulation_pct: e.total > 0 ? Math.round((e.annulations / e.total) * 1000) / 10 : 0,
      }));

      return NextResponse.json(result);
    }

    case "motif": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: decisions } = await (supabase
        .from("decisions")
        .select("motif_opa, motif_ops, motif_opd, motif_defaut_qualite, motif_vices_consentement, motif_objet_illicite, motif_contrepartie, resultat")
        .eq("status", "validated")
        .eq(scopeKey, scopeVal) as any) as { data: Record<string, unknown>[] | null };

      if (!decisions || decisions.length === 0) {
        return NextResponse.json([]);
      }

      const motifKeys: [string, string][] = [
        ["motif_opa", "Ordre public absolu"],
        ["motif_ops", "Ordre public social"],
        ["motif_opd", "Ordre public dérogatoire"],
        ["motif_defaut_qualite", "Défaut de qualité"],
        ["motif_vices_consentement", "Vices du consentement"],
        ["motif_objet_illicite", "Objet illicite"],
        ["motif_contrepartie", "Contrepartie illusoire"],
      ];

      const result = motifKeys.map(([key, label]) => {
        const invoked = decisions.filter((d) => d[key] === true);
        const successful = invoked.filter((d) => d.resultat === "annulation");
        return {
          motif: label,
          nb_invoque: invoked.length,
          taux_succes_pct: invoked.length > 0 ? Math.round((successful.length / invoked.length) * 1000) / 10 : 0,
        };
      });

      return NextResponse.json(result);
    }

    case "appel": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: decisions } = await (supabase
        .from("decisions")
        .select("appel, resultat_appel")
        .eq("status", "validated")
        .eq(scopeKey, scopeVal) as any) as { data: Array<{ appel: boolean | null; resultat_appel: string | null }> | null };

      if (!decisions || decisions.length === 0) {
        return NextResponse.json([]);
      }

      const withAppeal = decisions.filter((d) => d.appel === true);
      return NextResponse.json({
        total_appels: withAppeal.length,
        resultats: withAppeal.reduce((acc, d) => {
          const key = d.resultat_appel || "inconnu";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
    }

    default:
      return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  }
}

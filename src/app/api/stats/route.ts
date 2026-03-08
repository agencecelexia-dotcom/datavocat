import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  const type = request.nextUrl.searchParams.get("type") || "global";

  switch (type) {
    case "global": {
      const { data: decisions } = await supabase
        .from("decisions")
        .select("id, resultat, delai_statuer_mois, montant_condamnations")
        .eq("status", "validated");

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
      const { data, error } = await supabase
        .from("v_stats_par_juridiction")
        .select("*");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    case "motif": {
      const { data, error } = await supabase
        .from("v_stats_par_motif")
        .select("*");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    case "appel": {
      const { data, error } = await supabase
        .from("v_stats_appel")
        .select("*");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    default:
      return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  }
}

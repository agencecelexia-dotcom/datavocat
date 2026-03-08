import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monAffaireSchema } from "@/lib/validators/decision";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = monAffaireSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const params = parsed.data;

  // Call the SQL scoring function
  const { data, error } = await supabase.rpc("score_affaire_similaire", {
    p_juridiction_type: params.juridiction_type,
    p_perimetre: params.perimetre_conclusion,
    p_demandeur_type: params.demandeur_type,
    p_bloc: params.bloc_negociation,
    p_motif_opa: params.motif_opa,
    p_motif_ops: params.motif_ops,
    p_post_2017: params.post_ordonnance_2017,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data?.[0] || {
    total_similaires: 0,
    taux_annulation: null,
    taux_recevabilite: null,
    delai_moyen: null,
    montant_moyen: null,
    decisions_proches: [],
  };

  return NextResponse.json(result);
}

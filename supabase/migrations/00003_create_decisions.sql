-- Table principale : les décisions de justice
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Métadonnées
  source TEXT NOT NULL DEFAULT 'upload', -- 'upload', 'datagouv', 'legifrance'
  source_ref TEXT,
  pdf_path TEXT,
  raw_text TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  cabinet_id UUID REFERENCES cabinets(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'review', 'validated', 'error')),
  extraction_confidence FLOAT,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,

  -- ═══════════════════════════════════════════
  -- CATÉGORIE 1 : ACTIVITÉ JURIDICTIONNELLE
  -- ═══════════════════════════════════════════
  juridiction TEXT,
  juridiction_type TEXT, -- 'TJ', 'CA', 'CASS'
  juridiction_ville TEXT,
  juridiction_ressort TEXT,
  date_decision DATE,
  numero_rg TEXT,
  delai_statuer_mois INTEGER,
  ref_premiere_instance TEXT,
  ref_appel TEXT,
  appel_sens TEXT, -- 'confirmatif', 'infirmatif', 'partiellement_infirmatif'
  pourvoi BOOLEAN,
  cassation_ou_rejet TEXT, -- 'cassation', 'rejet', 'cassation_partielle'

  -- ═══════════════════════════════════════════
  -- CATÉGORIE 2 : ACCORDS CONTESTÉS
  -- ═══════════════════════════════════════════
  secteur_conclusion TEXT,
  objet_accord TEXT,
  bloc_negociation INTEGER CHECK (bloc_negociation IN (1, 2, 3)),
  stipulations_branche TEXT,
  perimetre_conclusion TEXT, -- 'établissement', 'entreprise', 'groupe', 'UES', 'branche'
  mode_conclusion TEXT,

  -- ═══════════════════════════════════════════
  -- CATÉGORIE 3 : RECEVABILITÉ
  -- ═══════════════════════════════════════════
  demandeur_type TEXT, -- 'employeur', 'OS_signataire', 'OS_non_signataire', 'salarié', 'CSE', 'tiers'
  demandeur_partie_ou_tiers TEXT, -- 'partie', 'tiers'
  forclusion BOOLEAN,
  forclusion_detail TEXT,
  defaut_interet_agir BOOLEAN,
  defaut_interet_agir_detail TEXT,
  defaut_qualite_agir BOOLEAN,
  defaut_qualite_agir_detail TEXT,
  recevable BOOLEAN,

  -- ═══════════════════════════════════════════
  -- CATÉGORIE 4 : CAUSES D'INVALIDITÉ
  -- ═══════════════════════════════════════════
  champ_demande_nullite TEXT,
  contraire_opa BOOLEAN,
  contraire_opa_detail TEXT,
  contraire_ops BOOLEAN,
  contraire_ops_detail TEXT,
  contraire_opd BOOLEAN,
  contraire_opd_detail TEXT,
  defaut_qualite_signataires BOOLEAN,
  defaut_qualite_signataires_detail TEXT,
  objet_illicite BOOLEAN,
  objet_illicite_detail TEXT,
  contrepartie_illusoire BOOLEAN,
  contrepartie_illusoire_detail TEXT,
  vices_consentement BOOLEAN,
  vices_consentement_detail TEXT,
  autres_demandes TEXT,

  -- ═══════════════════════════════════════════
  -- CATÉGORIE 5 : TRAITEMENT DE L'INVALIDITÉ
  -- ═══════════════════════════════════════════
  resultat TEXT, -- 'annulation', 'validation', 'irrecevabilité'
  annulation_totale_ou_partielle TEXT, -- 'totale', 'partielle'
  annulation_retroactive BOOLEAN,
  arguments_retroactivite TEXT,
  annulation_pour_avenir BOOLEAN,
  arguments_avenir TEXT,
  annulation_date_future BOOLEAN,
  arguments_date_future TEXT,
  dommages_identifies TEXT,
  montant_condamnations DECIMAL,
  debiteur_condamnations TEXT,
  creancier_condamnations TEXT,
  responsabilite_etat BOOLEAN,

  -- ═══════════════════════════════════════════
  -- MÉTADONNÉES TEMPORELLES
  -- ═══════════════════════════════════════════
  post_ordonnance_2017 BOOLEAN,

  -- ═══════════════════════════════════════════
  -- CHAÎNAGE CONTENTIEUX
  -- ═══════════════════════════════════════════
  decision_parent_id UUID REFERENCES decisions(id),
  decision_enfant_ids UUID[]
);

-- Index pour les requêtes statistiques fréquentes
CREATE INDEX idx_decisions_juridiction_type ON decisions(juridiction_type);
CREATE INDEX idx_decisions_juridiction_ville ON decisions(juridiction_ville);
CREATE INDEX idx_decisions_resultat ON decisions(resultat);
CREATE INDEX idx_decisions_demandeur_type ON decisions(demandeur_type);
CREATE INDEX idx_decisions_bloc ON decisions(bloc_negociation);
CREATE INDEX idx_decisions_perimetre ON decisions(perimetre_conclusion);
CREATE INDEX idx_decisions_date ON decisions(date_decision);
CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_decisions_post_2017 ON decisions(post_ordonnance_2017);
CREATE INDEX idx_decisions_cabinet ON decisions(cabinet_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

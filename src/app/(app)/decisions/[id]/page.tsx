"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Pencil, Check, Trash2, Save, X } from "lucide-react";
import type { Decision } from "@/types/database";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "En attente", variant: "secondary" },
  extracting: { label: "Extraction...", variant: "outline" },
  review: { label: "A valider", variant: "default" },
  validated: { label: "Validee", variant: "default" },
  error: { label: "Erreur", variant: "destructive" },
};

const solutionColors: Record<string, string> = {
  cassation: "bg-red-100 text-red-800",
  rejet: "bg-[#1e3a5f]/10 text-[#1e3a5f]",
  annulation: "bg-green-100 text-green-800",
  validation: "bg-red-100 text-red-800",
  irrecevabilite: "bg-yellow-100 text-yellow-800",
};

type TabKey = "resume" | "activite" | "details" | "texte";

const tabItems: { key: TabKey; label: string }[] = [
  { key: "resume", label: "Resume" },
  { key: "activite", label: "Activite juridictionnelle" },
  { key: "details", label: "Details (39 champs)" },
  { key: "texte", label: "Texte integral" },
];

function FieldRow({
  label,
  value,
  editing,
  fieldKey,
  editValues,
  onEdit,
  type = "text",
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  editing: boolean;
  fieldKey: string;
  editValues: Record<string, string>;
  onEdit: (key: string, val: string) => void;
  type?: "text" | "boolean" | "number";
}) {
  const display =
    value === null || value === undefined
      ? "\u2014"
      : typeof value === "boolean"
        ? value
          ? "Oui"
          : "Non"
        : String(value);

  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 border-b border-border/50 py-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {editing ? (
        type === "boolean" ? (
          <select
            className="rounded border border-input bg-transparent px-2 py-1 text-sm"
            value={editValues[fieldKey] ?? String(value ?? "")}
            onChange={(e) => onEdit(fieldKey, e.target.value)}
          >
            <option value="">{"\u2014"}</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        ) : (
          <Input
            type={type === "number" ? "number" : "text"}
            value={editValues[fieldKey] ?? String(value ?? "")}
            onChange={(e) => onEdit(fieldKey, e.target.value)}
            className="h-7"
          />
        )
      ) : (
        <span>{display}</span>
      )}
    </div>
  );
}

export default function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("resume");
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchDecision = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decisions/${id}`);
      if (!res.ok) {
        setError("Decision introuvable");
        return;
      }
      const data = await res.json();
      setDecision(data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDecision();
  }, [fetchDecision]);

  const handleEdit = (key: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(editValues)) {
        const field = key as keyof Decision;
        const original = decision[field];
        if (typeof original === "boolean" || original === null) {
          if (val === "true") updates[key] = true;
          else if (val === "false") updates[key] = false;
          else if (val === "") updates[key] = null;
          else updates[key] = val;
        } else if (typeof original === "number") {
          updates[key] = val === "" ? null : Number(val);
        } else {
          updates[key] = val === "" ? null : val;
        }
      }
      const res = await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setDecision(data);
        setEditing(false);
        setEditValues({});
      }
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    const res = await fetch(`/api/decisions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "validated" }),
    });
    if (res.ok) {
      const data = await res.json();
      setDecision(data);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/decisions/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/decisions");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-lg text-muted-foreground">{error || "Decision introuvable"}</p>
        <Button variant="outline" onClick={() => router.push("/decisions")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux decisions
        </Button>
      </div>
    );
  }

  const status = statusConfig[decision.status] || statusConfig.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/decisions")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-serif text-2xl font-bold text-[#1e3a5f]">
              {decision.juridiction || decision.juridiction_type || "Decision"}
              {decision.juridiction_ville && ` \u2014 ${decision.juridiction_ville}`}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-4 pl-12 text-sm text-muted-foreground">
            {decision.date_decision && (
              <span>{new Date(decision.date_decision).toLocaleDateString("fr-FR")}</span>
            )}
            {decision.numero_rg && (
              <span className="font-mono">RG {decision.numero_rg}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEditValues({});
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? "..." : "Enregistrer"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" />
                Modifier
              </Button>
              {decision.status === "review" && (
                <Button
                  onClick={handleValidate}
                  className="bg-[#2d6a4f] hover:bg-[#2d6a4f]/90 text-white"
                >
                  <Check className="mr-1 h-4 w-4" />
                  Valider
                </Button>
              )}
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" onClick={handleDelete}>
                    Confirmer
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    Non
                  </Button>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Supprimer
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ECLI + Pourvoi */}
      {(decision.source_ref || decision.numero_rg) && (
        <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-2 text-sm">
          {decision.source_ref && (
            <div>
              <span className="text-muted-foreground">ECLI : </span>
              <a
                href={`https://www.legifrance.gouv.fr/juri/id/${decision.source_ref}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#1e3a5f] underline underline-offset-2 hover:text-[#c9a96e]"
              >
                {decision.source_ref}
              </a>
            </div>
          )}
          {decision.numero_rg && (
            <div>
              <span className="text-muted-foreground">N. RG : </span>
              <span className="font-mono">{decision.numero_rg}</span>
            </div>
          )}
        </div>
      )}

      {/* Custom tabs (simple state toggle) */}
      <div className="border-b">
        <div className="flex gap-0">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-[#c9a96e] text-[#1e3a5f]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "resume" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-2">Solution</h3>
              {decision.resultat ? (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                    solutionColors[decision.resultat] || "bg-gray-100 text-gray-800"
                  }`}
                >
                  {decision.resultat.charAt(0).toUpperCase() + decision.resultat.slice(1)}
                </span>
              ) : (
                <span className="text-muted-foreground">Non renseignee</span>
              )}
              {decision.cassation_ou_rejet && (
                <span className="ml-3 text-sm text-muted-foreground">
                  ({decision.cassation_ou_rejet})
                </span>
              )}
            </div>

            {decision.objet_accord && (
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-2">Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {decision.objet_accord.split(",").map((t, i) => (
                    <Badge key={i} variant="secondary">
                      {t.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {decision.champ_demande_nullite && (
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-2">
                  Champ de la demande
                </h3>
                <p className="text-sm leading-relaxed">{decision.champ_demande_nullite}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {decision.mode_conclusion && (
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-1">
                    Mode de conclusion
                  </h3>
                  <p className="text-sm">{decision.mode_conclusion}</p>
                </div>
              )}
              {decision.perimetre_conclusion && (
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-1">
                    Perimetre
                  </h3>
                  <p className="text-sm">{decision.perimetre_conclusion}</p>
                </div>
              )}
            </div>

            {decision.extraction_confidence !== null && (
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-1">
                  Confiance extraction
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-48 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-[#2d6a4f]"
                      style={{
                        width: `${Math.round((decision.extraction_confidence ?? 0) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round((decision.extraction_confidence ?? 0) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "activite" && (
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
              Activite juridictionnelle
            </h3>
            <FieldRow label="Juridiction" value={decision.juridiction} editing={editing} fieldKey="juridiction" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Type" value={decision.juridiction_type} editing={editing} fieldKey="juridiction_type" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Ville" value={decision.juridiction_ville} editing={editing} fieldKey="juridiction_ville" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Ressort" value={decision.juridiction_ressort} editing={editing} fieldKey="juridiction_ressort" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Date decision" value={decision.date_decision} editing={editing} fieldKey="date_decision" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="N. RG" value={decision.numero_rg} editing={editing} fieldKey="numero_rg" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Delai (mois)" value={decision.delai_statuer_mois} editing={editing} fieldKey="delai_statuer_mois" editValues={editValues} onEdit={handleEdit} type="number" />
            <FieldRow label="Ref. 1ere instance" value={decision.ref_premiere_instance} editing={editing} fieldKey="ref_premiere_instance" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Ref. appel" value={decision.ref_appel} editing={editing} fieldKey="ref_appel" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Sens appel" value={decision.appel_sens} editing={editing} fieldKey="appel_sens" editValues={editValues} onEdit={handleEdit} />
            <FieldRow label="Pourvoi" value={decision.pourvoi} editing={editing} fieldKey="pourvoi" editValues={editValues} onEdit={handleEdit} type="boolean" />
            <FieldRow label="Cassation / Rejet" value={decision.cassation_ou_rejet} editing={editing} fieldKey="cassation_ou_rejet" editValues={editValues} onEdit={handleEdit} />
          </div>
        )}

        {activeTab === "details" && (
          <div className="space-y-8">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
                Accords contestes
              </h3>
              <FieldRow label="Secteur conclusion" value={decision.secteur_conclusion} editing={editing} fieldKey="secteur_conclusion" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Objet accord" value={decision.objet_accord} editing={editing} fieldKey="objet_accord" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Bloc negociation" value={decision.bloc_negociation} editing={editing} fieldKey="bloc_negociation" editValues={editValues} onEdit={handleEdit} type="number" />
              <FieldRow label="Stipulations branche" value={decision.stipulations_branche} editing={editing} fieldKey="stipulations_branche" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Perimetre conclusion" value={decision.perimetre_conclusion} editing={editing} fieldKey="perimetre_conclusion" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Mode conclusion" value={decision.mode_conclusion} editing={editing} fieldKey="mode_conclusion" editValues={editValues} onEdit={handleEdit} />
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
                Recevabilite
              </h3>
              <FieldRow label="Type demandeur" value={decision.demandeur_type} editing={editing} fieldKey="demandeur_type" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Partie / Tiers" value={decision.demandeur_partie_ou_tiers} editing={editing} fieldKey="demandeur_partie_ou_tiers" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Forclusion" value={decision.forclusion} editing={editing} fieldKey="forclusion" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail forclusion" value={decision.forclusion_detail} editing={editing} fieldKey="forclusion_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Defaut interet a agir" value={decision.defaut_interet_agir} editing={editing} fieldKey="defaut_interet_agir" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail interet a agir" value={decision.defaut_interet_agir_detail} editing={editing} fieldKey="defaut_interet_agir_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Defaut qualite a agir" value={decision.defaut_qualite_agir} editing={editing} fieldKey="defaut_qualite_agir" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail qualite a agir" value={decision.defaut_qualite_agir_detail} editing={editing} fieldKey="defaut_qualite_agir_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Recevable" value={decision.recevable} editing={editing} fieldKey="recevable" editValues={editValues} onEdit={handleEdit} type="boolean" />
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
                Causes d&apos;invalidite
              </h3>
              <FieldRow label="Champ demande nullite" value={decision.champ_demande_nullite} editing={editing} fieldKey="champ_demande_nullite" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Contraire OPA" value={decision.contraire_opa} editing={editing} fieldKey="contraire_opa" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail OPA" value={decision.contraire_opa_detail} editing={editing} fieldKey="contraire_opa_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Contraire OPS" value={decision.contraire_ops} editing={editing} fieldKey="contraire_ops" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail OPS" value={decision.contraire_ops_detail} editing={editing} fieldKey="contraire_ops_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Contraire OPD" value={decision.contraire_opd} editing={editing} fieldKey="contraire_opd" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail OPD" value={decision.contraire_opd_detail} editing={editing} fieldKey="contraire_opd_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Defaut qualite signataires" value={decision.defaut_qualite_signataires} editing={editing} fieldKey="defaut_qualite_signataires" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail qualite signataires" value={decision.defaut_qualite_signataires_detail} editing={editing} fieldKey="defaut_qualite_signataires_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Objet illicite" value={decision.objet_illicite} editing={editing} fieldKey="objet_illicite" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail objet illicite" value={decision.objet_illicite_detail} editing={editing} fieldKey="objet_illicite_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Contrepartie illusoire" value={decision.contrepartie_illusoire} editing={editing} fieldKey="contrepartie_illusoire" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail contrepartie" value={decision.contrepartie_illusoire_detail} editing={editing} fieldKey="contrepartie_illusoire_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Vices consentement" value={decision.vices_consentement} editing={editing} fieldKey="vices_consentement" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Detail vices" value={decision.vices_consentement_detail} editing={editing} fieldKey="vices_consentement_detail" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Autres demandes" value={decision.autres_demandes} editing={editing} fieldKey="autres_demandes" editValues={editValues} onEdit={handleEdit} />
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
                Traitement de l&apos;invalidite
              </h3>
              <FieldRow label="Resultat" value={decision.resultat} editing={editing} fieldKey="resultat" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Annulation totale/partielle" value={decision.annulation_totale_ou_partielle} editing={editing} fieldKey="annulation_totale_ou_partielle" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Annulation retroactive" value={decision.annulation_retroactive} editing={editing} fieldKey="annulation_retroactive" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Arguments retroactivite" value={decision.arguments_retroactivite} editing={editing} fieldKey="arguments_retroactivite" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Annulation pour avenir" value={decision.annulation_pour_avenir} editing={editing} fieldKey="annulation_pour_avenir" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Arguments avenir" value={decision.arguments_avenir} editing={editing} fieldKey="arguments_avenir" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Annulation date future" value={decision.annulation_date_future} editing={editing} fieldKey="annulation_date_future" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Arguments date future" value={decision.arguments_date_future} editing={editing} fieldKey="arguments_date_future" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Dommages identifies" value={decision.dommages_identifies} editing={editing} fieldKey="dommages_identifies" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Montant condamnations" value={decision.montant_condamnations} editing={editing} fieldKey="montant_condamnations" editValues={editValues} onEdit={handleEdit} type="number" />
              <FieldRow label="Debiteur" value={decision.debiteur_condamnations} editing={editing} fieldKey="debiteur_condamnations" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Creancier" value={decision.creancier_condamnations} editing={editing} fieldKey="creancier_condamnations" editValues={editValues} onEdit={handleEdit} />
              <FieldRow label="Responsabilite Etat" value={decision.responsabilite_etat} editing={editing} fieldKey="responsabilite_etat" editValues={editValues} onEdit={handleEdit} type="boolean" />
              <FieldRow label="Post ordonnance 2017" value={decision.post_ordonnance_2017} editing={editing} fieldKey="post_ordonnance_2017" editValues={editValues} onEdit={handleEdit} type="boolean" />
            </div>
          </div>
        )}

        {activeTab === "texte" && (
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#1e3a5f] mb-3">
              Texte integral
            </h3>
            {decision.raw_text ? (
              <div className="max-h-[600px] overflow-y-auto rounded-lg border bg-muted/20 p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {decision.raw_text}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground">Texte non disponible</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Decision } from "@/types/database";

export default function DecisionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [editing, setEditing] = useState<Partial<Decision>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/decisions/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setDecision(data);
        setEditing(data);
      }
    }
    load();
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/decisions/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (res.ok) {
      const updated = await res.json();
      setDecision(updated);
      toast.success("Décision mise à jour");
    } else {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const handleValidate = async () => {
    setSaving(true);
    const res = await fetch(`/api/decisions/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, status: "validated" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDecision(updated);
      toast.success("Décision validée");
    }
    setSaving(false);
  };

  const updateField = (field: string, value: unknown) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  if (!decision) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  const renderTextField = (
    label: string,
    field: keyof Decision,
    multiline = false
  ) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          value={(editing[field] as string) || ""}
          onChange={(e) => updateField(field, e.target.value || null)}
          rows={3}
        />
      ) : (
        <Input
          value={(editing[field] as string) || ""}
          onChange={(e) => updateField(field, e.target.value || null)}
        />
      )}
    </div>
  );

  const renderBoolField = (label: string, field: keyof Decision) => (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch
        checked={!!editing[field]}
        onCheckedChange={(v) => updateField(field, v)}
      />
    </div>
  );

  const renderNumberField = (label: string, field: keyof Decision) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={(editing[field] as number) ?? ""}
        onChange={(e) =>
          updateField(field, e.target.value ? Number(e.target.value) : null)
        }
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {decision.juridiction || "Décision"}{" "}
              {decision.numero_rg && `— ${decision.numero_rg}`}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {decision.date_decision &&
                new Date(decision.date_decision).toLocaleDateString("fr-FR")}
              <Badge
                variant={
                  decision.status === "validated" ? "default" : "secondary"
                }
              >
                {decision.status}
              </Badge>
              {decision.extraction_confidence !== null && (
                <span>
                  Confiance: {Math.round(decision.extraction_confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Sauvegarder
          </Button>
          {decision.status === "review" && (
            <Button onClick={handleValidate} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Valider
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="cat1">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cat1">Activité juridictionnelle</TabsTrigger>
          <TabsTrigger value="cat2">Accords contestés</TabsTrigger>
          <TabsTrigger value="cat3">Recevabilité</TabsTrigger>
          <TabsTrigger value="cat4">Causes d&apos;invalidité</TabsTrigger>
          <TabsTrigger value="cat5">Traitement</TabsTrigger>
        </TabsList>

        <TabsContent value="cat1">
          <Card>
            <CardHeader>
              <CardTitle>Activité juridictionnelle</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renderTextField("Juridiction", "juridiction")}
              {renderTextField("Type", "juridiction_type")}
              {renderTextField("Ville", "juridiction_ville")}
              {renderTextField("Ressort", "juridiction_ressort")}
              {renderTextField("Date décision", "date_decision")}
              {renderTextField("N° RG", "numero_rg")}
              {renderNumberField("Délai pour statuer (mois)", "delai_statuer_mois")}
              {renderTextField("Réf. 1ère instance", "ref_premiere_instance")}
              {renderTextField("Réf. appel", "ref_appel")}
              {renderTextField("Sens appel", "appel_sens")}
              {renderBoolField("Pourvoi formé", "pourvoi")}
              {renderTextField("Cassation/rejet", "cassation_ou_rejet")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cat2">
          <Card>
            <CardHeader>
              <CardTitle>Accords contestés</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renderTextField("Secteur de conclusion", "secteur_conclusion")}
              {renderTextField("Objet de l'accord", "objet_accord", true)}
              {renderNumberField("Bloc de négociation", "bloc_negociation")}
              {renderTextField("Stipulations de branche", "stipulations_branche", true)}
              {renderTextField("Périmètre", "perimetre_conclusion")}
              {renderTextField("Mode de conclusion", "mode_conclusion")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cat3">
          <Card>
            <CardHeader>
              <CardTitle>Recevabilité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renderTextField("Type de demandeur", "demandeur_type")}
              {renderTextField("Partie/Tiers", "demandeur_partie_ou_tiers")}
              {renderBoolField("Forclusion", "forclusion")}
              {renderTextField("Détail forclusion", "forclusion_detail", true)}
              {renderBoolField("Défaut d'intérêt à agir", "defaut_interet_agir")}
              {renderTextField("Détail", "defaut_interet_agir_detail", true)}
              {renderBoolField("Défaut de qualité à agir", "defaut_qualite_agir")}
              {renderTextField("Détail", "defaut_qualite_agir_detail", true)}
              {renderBoolField("Recevable", "recevable")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cat4">
          <Card>
            <CardHeader>
              <CardTitle>Causes d&apos;invalidité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renderTextField("Champ de la nullité", "champ_demande_nullite", true)}
              {renderBoolField("Contraire OPA", "contraire_opa")}
              {renderTextField("Détail OPA", "contraire_opa_detail", true)}
              {renderBoolField("Contraire OPS", "contraire_ops")}
              {renderTextField("Détail OPS", "contraire_ops_detail", true)}
              {renderBoolField("Contraire OPD", "contraire_opd")}
              {renderTextField("Détail OPD", "contraire_opd_detail", true)}
              {renderBoolField("Défaut qualité signataires", "defaut_qualite_signataires")}
              {renderTextField("Détail", "defaut_qualite_signataires_detail", true)}
              {renderBoolField("Objet illicite", "objet_illicite")}
              {renderTextField("Détail", "objet_illicite_detail", true)}
              {renderBoolField("Contrepartie illusoire", "contrepartie_illusoire")}
              {renderTextField("Détail", "contrepartie_illusoire_detail", true)}
              {renderBoolField("Vices du consentement", "vices_consentement")}
              {renderTextField("Détail", "vices_consentement_detail", true)}
              {renderTextField("Autres demandes", "autres_demandes", true)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cat5">
          <Card>
            <CardHeader>
              <CardTitle>Traitement de l&apos;invalidité</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {renderTextField("Résultat", "resultat")}
              {renderTextField("Totale/Partielle", "annulation_totale_ou_partielle")}
              {renderBoolField("Rétroactive", "annulation_retroactive")}
              {renderTextField("Arguments rétroactivité", "arguments_retroactivite", true)}
              {renderBoolField("Pour l'avenir", "annulation_pour_avenir")}
              {renderTextField("Arguments avenir", "arguments_avenir", true)}
              {renderBoolField("Date future", "annulation_date_future")}
              {renderTextField("Arguments date future", "arguments_date_future", true)}
              {renderTextField("Dommages identifiés", "dommages_identifies", true)}
              {renderNumberField("Montant condamnations", "montant_condamnations")}
              {renderTextField("Débiteur", "debiteur_condamnations")}
              {renderTextField("Créancier", "creancier_condamnations")}
              {renderBoolField("Responsabilité État", "responsabilite_etat")}
              {renderBoolField("Post ordonnance 2017", "post_ordonnance_2017")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

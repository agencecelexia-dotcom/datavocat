"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { monAffaireSchema, type MonAffaireInput } from "@/lib/validators/decision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

interface CaseFormProps {
  onSubmit: (data: MonAffaireInput) => void;
  loading?: boolean;
}

export function CaseForm({ onSubmit, loading }: CaseFormProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<MonAffaireInput>({
    resolver: zodResolver(monAffaireSchema) as any,
    defaultValues: {
      juridiction_type: "TJ",
      perimetre_conclusion: "entreprise",
      demandeur_type: "OS_non_signataire",
      bloc_negociation: 3,
      motif_opa: false,
      motif_ops: false,
      motif_opd: false,
      motif_defaut_qualite_signataires: false,
      motif_vices_consentement: false,
      motif_objet_illicite: false,
      motif_contrepartie_illusoire: false,
      post_ordonnance_2017: true,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit as any)}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Paramètres de l&apos;affaire</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Juridiction visée</Label>
              <Select
                value={form.watch("juridiction_type")}
                onValueChange={(v) =>
                  form.setValue("juridiction_type", v as "TJ" | "CA" | "CASS")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TJ">Tribunal judiciaire</SelectItem>
                  <SelectItem value="CA">Cour d&apos;appel</SelectItem>
                  <SelectItem value="CASS">Cour de cassation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ville / Ressort (optionnel)</Label>
              <Input
                placeholder="ex: Montpellier"
                {...form.register("juridiction_ville")}
              />
            </div>

            <div className="space-y-2">
              <Label>Périmètre de conclusion</Label>
              <Select
                value={form.watch("perimetre_conclusion")}
                onValueChange={(v) =>
                  form.setValue("perimetre_conclusion", v as MonAffaireInput["perimetre_conclusion"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="établissement">Établissement</SelectItem>
                  <SelectItem value="entreprise">Entreprise</SelectItem>
                  <SelectItem value="groupe">Groupe</SelectItem>
                  <SelectItem value="UES">UES</SelectItem>
                  <SelectItem value="branche">Branche</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Qualité du demandeur</Label>
              <Select
                value={form.watch("demandeur_type")}
                onValueChange={(v) =>
                  form.setValue("demandeur_type", v as MonAffaireInput["demandeur_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employeur">Employeur</SelectItem>
                  <SelectItem value="OS_signataire">OS signataire</SelectItem>
                  <SelectItem value="OS_non_signataire">
                    OS non signataire
                  </SelectItem>
                  <SelectItem value="salarié">Salarié</SelectItem>
                  <SelectItem value="CSE">CSE</SelectItem>
                  <SelectItem value="tiers">Tiers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bloc de négociation</Label>
              <Select
                value={String(form.watch("bloc_negociation"))}
                onValueChange={(v) =>
                  form.setValue("bloc_negociation", Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Bloc 1 (branche prime)</SelectItem>
                  <SelectItem value="2">Bloc 2 (branche verrouille)</SelectItem>
                  <SelectItem value="3">Bloc 3 (entreprise prime)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Secteur (optionnel)</Label>
              <Input
                placeholder="ex: Métallurgie, BTP..."
                {...form.register("secteur_conclusion")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motifs invoqués</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { field: "motif_opa" as const, label: "Contraire à l'ordre public absolu (OPA)" },
              { field: "motif_ops" as const, label: "Contraire à l'ordre public social (OPS)" },
              { field: "motif_opd" as const, label: "Contraire à l'ordre public dérogatoire (OPD)" },
              { field: "motif_defaut_qualite_signataires" as const, label: "Défaut de qualité des signataires" },
              { field: "motif_vices_consentement" as const, label: "Vices du consentement" },
              { field: "motif_objet_illicite" as const, label: "Objet illicite" },
              { field: "motif_contrepartie_illusoire" as const, label: "Contrepartie illusoire ou dérisoire" },
            ].map(({ field, label }) => (
              <div key={field} className="flex items-center gap-3">
                <Checkbox
                  id={field}
                  checked={form.watch(field)}
                  onCheckedChange={(v) => form.setValue(field, !!v)}
                />
                <Label htmlFor={field} className="cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contexte temporel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Accord post-ordonnance du 22/09/2017</Label>
                <p className="text-sm text-muted-foreground">
                  Art. L.2262-14 CT — délai de forclusion de 2 mois
                </p>
              </div>
              <Switch
                checked={form.watch("post_ordonnance_2017")}
                onCheckedChange={(v) =>
                  form.setValue("post_ordonnance_2017", v)
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          {loading ? "Analyse en cours..." : "Analyser mon affaire"}
        </Button>
      </div>
    </form>
  );
}

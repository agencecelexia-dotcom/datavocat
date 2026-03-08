"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Download, Database } from "lucide-react";

export default function ImportPage() {
  const [query, setQuery] = useState(
    "décisions justice travail accord collectif"
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/import/datagouv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de la recherche");
      }

      const data = await res.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import data.gouv.fr
        </h1>
        <p className="text-muted-foreground">
          Recherchez et importez des décisions de justice depuis les données
          ouvertes de data.gouv.fr via le protocole MCP.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Recherche de datasets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Termes de recherche</Label>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="décisions justice travail accord collectif"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Recherche..." : "Rechercher"}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuery("JUDILIBRE Cour cassation chambre sociale")
              }
            >
              JUDILIBRE (Cass.)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuery("décisions cours appel droit travail")
              }
            >
              Cours d&apos;appel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuery("tribunaux judiciaires droit social")
              }
            >
              Tribunaux judiciaires
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-sm">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Note :</strong> Le MCP data.gouv.fr est en phase
            expérimentale. Chaque décision importée passe par la validation
            humaine avant intégration dans le moteur statistique.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

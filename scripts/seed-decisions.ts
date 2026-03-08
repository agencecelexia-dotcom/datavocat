/**
 * Script d'import des 46 décisions ACTA'IA depuis un fichier CSV
 *
 * Usage: npx tsx scripts/seed-decisions.ts <chemin-du-csv>
 *
 * Le CSV n'est pas encore disponible. Ce script est prêt à être utilisé
 * dès que le fichier sera fourni.
 *
 * Le CSV doit contenir les colonnes correspondant aux 39 champs
 * de la grille d'analyse ACTA'IA.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mapping des colonnes CSV vers les colonnes de la BDD
const CSV_COLUMN_MAP: Record<string, string> = {
  // Le mapping exact sera défini quand le CSV sera disponible
  // Exemple :
  // "Juridiction": "juridiction",
  // "Type juridiction": "juridiction_type",
  // "Ville": "juridiction_ville",
  // etc.
};

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
}

function mapRow(csvRow: Record<string, string>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {
    source: "seed",
    status: "validated",
  };

  for (const [csvCol, dbCol] of Object.entries(CSV_COLUMN_MAP)) {
    const value = csvRow[csvCol];
    if (value === undefined || value === "") {
      mapped[dbCol] = null;
    } else if (value === "oui" || value === "Oui" || value === "TRUE") {
      mapped[dbCol] = true;
    } else if (value === "non" || value === "Non" || value === "FALSE") {
      mapped[dbCol] = false;
    } else if (!isNaN(Number(value)) && value !== "") {
      mapped[dbCol] = Number(value);
    } else {
      mapped[dbCol] = value;
    }
  }

  return mapped;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/seed-decisions.ts <chemin-du-csv>");
    console.error("\nLe CSV des 46 décisions ACTA'IA n'est pas encore fourni.");
    console.error("Ce script sera fonctionnel une fois le CSV disponible.");
    process.exit(1);
  }

  const fullPath = resolve(csvPath);
  console.log(`Lecture du fichier: ${fullPath}`);
  const content = readFileSync(fullPath, "utf-8");
  const rows = parseCSV(content);
  console.log(`${rows.length} lignes trouvées dans le CSV`);

  if (Object.keys(CSV_COLUMN_MAP).length === 0) {
    console.error("\nATTENTION: Le mapping CSV_COLUMN_MAP n'est pas encore configuré.");
    console.error("Veuillez adapter le mapping en fonction des colonnes du CSV fourni.");
    process.exit(1);
  }

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    const mapped = mapRow(row);
    const { error } = await supabase.from("decisions").insert(mapped);
    if (error) {
      console.error(`Erreur insertion:`, error.message);
      errors++;
    } else {
      inserted++;
    }
  }

  console.log(`\nTerminé: ${inserted} insérées, ${errors} erreurs`);
}

main().catch(console.error);

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Scale } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          cabinet_name: cabinetName,
        },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <Scale className="mx-auto h-10 w-10 text-primary" />
          <CardTitle className="text-2xl">Vérifiez votre email</CardTitle>
          <CardDescription>
            Un lien de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez sur le lien pour activer votre compte.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <Scale className="mx-auto h-10 w-10 text-primary" />
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>
          Inscrivez-vous pour accéder à Datavocat
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Me Jean Dupont"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cabinetName">Nom du cabinet</Label>
            <Input
              id="cabinetName"
              type="text"
              placeholder="Cabinet Dupont & Associés"
              value={cabinetName}
              onChange={(e) => setCabinetName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email professionnel</Label>
            <Input
              id="email"
              type="email"
              placeholder="avocat@cabinet.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Inscription en cours..." : "S'inscrire"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-primary underline">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

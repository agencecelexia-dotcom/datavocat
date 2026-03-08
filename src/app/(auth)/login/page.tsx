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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
            Un lien de connexion a été envoyé à <strong>{email}</strong>.
            Cliquez sur le lien dans l&apos;email pour vous connecter.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="ghost" onClick={() => setSent(false)}>
            Renvoyer le lien
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <Scale className="mx-auto h-10 w-10 text-primary" />
        <CardTitle className="text-2xl">Datavocat</CardTitle>
        <CardDescription>
          Connectez-vous avec votre adresse email professionnelle
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            {loading ? "Envoi en cours..." : "Recevoir le lien de connexion"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-primary underline">
              S&apos;inscrire
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

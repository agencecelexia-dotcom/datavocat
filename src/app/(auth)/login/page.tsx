"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="text-center space-y-4 pb-6">
        <Scale className="mx-auto h-10 w-10 text-[#1e3a5f]" />
        <div className="space-y-1.5">
          <CardTitle className="font-serif text-2xl text-[#0f172a]">
            Connexion
          </CardTitle>
          <CardDescription className="text-sm text-[#0f172a]/60">
            Accedez a votre espace Datavocat
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-5 px-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-[#0f172a]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="avocat@cabinet.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-[#0f172a]">
              Mot de passe
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          {error && (
            <p className="text-sm text-[#9b2226] font-medium">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4 px-6 pt-2 pb-6">
          <Button
            type="submit"
            className="w-full cursor-pointer bg-[#c9a96e] text-white hover:bg-[#b8944f] transition-all duration-200 font-medium"
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
          <p className="text-sm text-[#0f172a]/60">
            Pas encore de compte ?{" "}
            <Link
              href="/register"
              className="text-[#c9a96e] hover:text-[#b8944f] underline underline-offset-2 cursor-pointer transition-colors duration-200 font-medium"
            >
              S&apos;inscrire
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

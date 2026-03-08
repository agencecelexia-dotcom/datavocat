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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          cabinet_name: cabinetName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setLoading(false);
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center space-y-4 pb-6">
          <Scale className="mx-auto h-10 w-10 text-[#1e3a5f]" />
          <CardTitle className="font-serif text-2xl text-[#0f172a]">
            Inscription envoyee
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 px-6 pb-6">
          <p className="text-sm text-[#0f172a]/60">
            Verifiez votre email pour confirmer votre inscription.
          </p>
          <Link
            href="/login"
            className="inline-block text-[#c9a96e] hover:text-[#b8944f] underline underline-offset-2 text-sm font-medium cursor-pointer transition-colors duration-200"
          >
            Retour a la connexion
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="text-center space-y-4 pb-6">
        <Scale className="mx-auto h-10 w-10 text-[#1e3a5f]" />
        <div className="space-y-1.5">
          <CardTitle className="font-serif text-2xl text-[#0f172a]">
            Creer un compte
          </CardTitle>
          <CardDescription className="text-sm text-[#0f172a]/60">
            Inscrivez-vous pour acceder a Datavocat
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-5 px-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium text-[#0f172a]">
              Nom complet
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Me Jean Dupont"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cabinetName" className="text-sm font-medium text-[#0f172a]">
              Nom du cabinet
            </Label>
            <Input
              id="cabinetName"
              type="text"
              placeholder="Cabinet Dupont & Associes"
              value={cabinetName}
              onChange={(e) => setCabinetName(e.target.value)}
              required
              className="transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-[#0f172a]">
              Email professionnel
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
              placeholder="Minimum 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
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
            {loading ? "Inscription en cours..." : "S'inscrire"}
          </Button>
          <p className="text-sm text-[#0f172a]/60">
            Deja un compte ?{" "}
            <Link
              href="/login"
              className="text-[#c9a96e] hover:text-[#b8944f] underline underline-offset-2 cursor-pointer transition-colors duration-200 font-medium"
            >
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

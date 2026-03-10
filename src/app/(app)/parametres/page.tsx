"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Building2,
  Mail,
  Lock,
  Bell,
  Palette,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  HelpCircle,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { scheduleTour } from "@/hooks/use-product-tour";

interface UserProfile {
  email: string;
  fullName: string;
  cabinetName: string;
}

interface Preferences {
  emailNotifications: boolean;
  analysisAutoSave: boolean;
  darkMode: boolean;
  compactView: boolean;
}

type ActiveTab = "profil" | "securite" | "preferences" | "legal";

export default function ParametresPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("profil");
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    fullName: "",
    cabinetName: "",
  });
  const [preferences, setPreferences] = useState<Preferences>({
    emailNotifications: true,
    analysisAutoSave: true,
    darkMode: false,
    compactView: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setProfile({
          email: user.email || "",
          fullName: user.user_metadata?.full_name || "",
          cabinetName: user.user_metadata?.cabinet_name || "",
        });
      }

      // Load preferences from localStorage
      const stored = localStorage.getItem("datavocat_preferences");
      if (stored) {
        try {
          setPreferences({ ...preferences, ...JSON.parse(stored) });
        } catch {
          // ignore
        }
      }
      const theme = localStorage.getItem("datavocat_theme");
      setPreferences((prev) => ({ ...prev, darkMode: theme === "dark" }));
      setLoading(false);
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName,
          cabinet_name: profile.cabinetName,
        },
      });
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.new.length < 6) {
      setPasswordError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new,
      });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setPasswordForm({ current: "", new: "", confirm: "" });
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePreferences = (newPrefs: Preferences) => {
    setPreferences(newPrefs);
    localStorage.setItem("datavocat_preferences", JSON.stringify(newPrefs));

    // Apply dark mode immediately
    if (newPrefs.darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("datavocat_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("datavocat_theme", "light");
    }
  };

  const tabs = [
    { key: "profil" as const, label: "Profil", icon: User },
    { key: "securite" as const, label: "Sécurité", icon: Lock },
    { key: "preferences" as const, label: "Préférences", icon: Palette },
    { key: "legal" as const, label: "Légal", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#1e3a5f]">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez votre profil, sécurité et préférences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-muted/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Profil tab */}
      {activeTab === "profil" && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Informations personnelles
            </h2>
            <p className="text-sm text-muted-foreground">
              Mettez à jour vos informations de profil
            </p>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="h-11 pl-10 opacity-60"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié. Contactez le support si nécessaire.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    placeholder="Me Jean Dupont"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cabinet">Nom du cabinet</Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="cabinet"
                    value={profile.cabinetName}
                    onChange={(e) =>
                      setProfile({ ...profile, cabinetName: e.target.value })
                    }
                    placeholder="Dupont & Associés"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="cursor-pointer gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Enregistré" : "Enregistrer"}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600">
                Profil mis à jour avec succès
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Sécurité tab */}
      {activeTab === "securite" && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Changer le mot de passe
            </h2>
            <p className="text-sm text-muted-foreground">
              Mettez à jour votre mot de passe pour sécuriser votre compte
            </p>
          </div>
          <Separator />
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current: e.target.value })
                  }
                  placeholder="Votre mot de passe actuel"
                  className="h-11 pl-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new: e.target.value })
                    }
                    placeholder="Minimum 6 caractères"
                    minLength={6}
                    required
                    className="h-11 pl-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmer</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm: e.target.value,
                      })
                    }
                    placeholder="Confirmez le mot de passe"
                    required
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Mot de passe mis à jour avec succès
              </div>
            )}

            <Button
              type="submit"
              disabled={changingPassword}
              className="cursor-pointer gap-2"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Mettre à jour le mot de passe
            </Button>
          </form>

          <Separator />

          {/* Danger zone */}
          <div>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              Zone dangereuse
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              La suppression du compte est irréversible. Toutes vos analyses,
              clients et données seront définitivement supprimés.
            </p>
            <Button
              variant="outline"
              className="mt-3 cursor-pointer border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() =>
                alert(
                  "Pour supprimer votre compte, contactez le support à support@datavocat.fr"
                )
              }
            >
              Supprimer mon compte
            </Button>
          </div>
        </Card>
      )}

      {/* Préférences tab */}
      {activeTab === "preferences" && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Préférences
            </h2>
            <p className="text-sm text-muted-foreground">
              Personnalisez votre expérience Datavocat
            </p>
          </div>
          <Separator />
          <div className="space-y-6">
            {/* Apparence */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Palette className="h-4 w-4 text-[#1e3a5f]" />
                Apparence
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Mode sombre
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Utiliser le thème sombre pour l'interface
                    </p>
                  </div>
                  <Switch
                    checked={preferences.darkMode}
                    onCheckedChange={(checked) =>
                      handleSavePreferences({
                        ...preferences,
                        darkMode: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Vue compacte
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Réduire l'espacement pour afficher plus de contenu
                    </p>
                  </div>
                  <Switch
                    checked={preferences.compactView}
                    onCheckedChange={(checked) =>
                      handleSavePreferences({
                        ...preferences,
                        compactView: checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell className="h-4 w-4 text-[#1e3a5f]" />
                Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Notifications par email
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recevoir un email lorsqu'une analyse est terminée
                    </p>
                  </div>
                  <Switch
                    checked={preferences.emailNotifications}
                    onCheckedChange={(checked) =>
                      handleSavePreferences({
                        ...preferences,
                        emailNotifications: checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Analyses */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-[#1e3a5f]" />
                Analyses
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Sauvegarde automatique
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sauvegarder automatiquement chaque analyse dans
                      l'historique
                    </p>
                  </div>
                  <Switch
                    checked={preferences.analysisAutoSave}
                    onCheckedChange={(checked) =>
                      handleSavePreferences({
                        ...preferences,
                        analysisAutoSave: checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Aide & Tutoriel */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <HelpCircle className="h-4 w-4 text-[#1e3a5f]" />
                Aide & Tutoriel
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Tutoriel guide
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Relancez le tutoriel interactif pour decouvrir toutes les
                      fonctionnalites de Datavocat
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 cursor-pointer gap-1.5 border-[#1e3a5f]/20 text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                    onClick={() => {
                      scheduleTour();
                      router.push("/");
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Revoir le tutoriel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Légal tab */}
      {activeTab === "legal" && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Informations légales
            </h2>
            <p className="text-sm text-muted-foreground">
              Documents juridiques et réglementaires
            </p>
          </div>
          <Separator />
          <div className="space-y-3">
            {[
              {
                title: "Mentions légales",
                desc: "Éditeur, hébergeur, directeur de publication",
                href: "/mentions-legales",
              },
              {
                title: "Conditions générales d'utilisation",
                desc: "Règles d'utilisation du service Datavocat",
                href: "/cgu",
              },
              {
                title: "Politique de confidentialité",
                desc: "Traitement des données personnelles et RGPD",
                href: "/confidentialite",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-lg border border-border/40 p-4 transition-all duration-200 hover:border-[#1e3a5f]/20 hover:shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-[#1e3a5f]">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-[#1e3a5f]" />
              </Link>
            ))}
          </div>

          <Separator />
          <div className="text-xs text-muted-foreground">
            <p>Datavocat v1.0 — &copy; {new Date().getFullYear()} Datavocat SAS</p>
            <p className="mt-1">
              Hébergé en France — Conforme RGPD — Données chiffrées
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

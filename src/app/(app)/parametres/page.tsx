"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Building2,
  Mail,
  Lock,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface UserProfile {
  email: string;
  fullName: string;
  cabinetName: string;
}

type ActiveTab = "profil" | "securite" | "legal";

function Field({
  label,
  id,
  icon: Icon,
  children,
  hint,
}: {
  label: string;
  id: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
        )}
        {children}
      </div>
      {hint && (
        <p
          className="mt-1.5 text-[11px]"
          style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2
        className="font-serif text-[22px] font-medium tracking-tight"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h2>
      <p
        className="mt-1 text-[13px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {subtitle}
      </p>
    </div>
  );
}

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("profil");
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    fullName: "",
    cabinetName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
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
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaved(false);
    setProfileError(null);
    try {
      const supabase = createClient();
      // `updateUser({ data })` REMPLACE l'intégralité de user_metadata : il
      // faut donc repartir des métadonnées existantes, sans quoi les autres
      // clés sont perdues à chaque sauvegarde de profil.
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      const existing = (current?.user_metadata || {}) as Record<string, unknown>;

      const { error } = await supabase.auth.updateUser({
        data: {
          ...existing,
          full_name: profile.fullName,
          cabinet_name: profile.cabinetName,
        },
      });
      if (error) {
        setProfileError(
          error.message || "La sauvegarde a échoué. Réessayez dans un instant."
        );
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setProfileError("La sauvegarde a échoué. Vérifiez votre connexion.");
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
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
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

  const tabs = [
    { key: "profil" as const, label: "Profil", icon: User },
    { key: "securite" as const, label: "Sécurité", icon: Lock },
    { key: "legal" as const, label: "Légal", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--ink)",
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: "var(--gold)" }}
          >
            § Paramètres
          </span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>

        <h1 className="font-serif text-[36px] lg:text-[40px] font-medium tracking-tight mb-2">
          Votre <span className="dv-italic">compte.</span>
        </h1>
        <p
          className="text-[14px] mb-10"
          style={{ color: "var(--muted-foreground)" }}
        >
          Gérez votre profil, sécurité et préférences d&apos;interface.
        </p>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 mb-8 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] cursor-pointer transition-all"
                style={{
                  color: active ? "var(--ink)" : "var(--muted-foreground)",
                  fontWeight: active ? 500 : 400,
                  borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Profil */}
        {activeTab === "profil" && (
          <div>
            <SectionHeader
              title="Informations personnelles"
              subtitle="Mettez à jour votre nom et votre cabinet."
            />

            <div className="space-y-5">
              <Field label="Adresse email" id="email" icon={Mail} hint="L'email ne peut pas être modifié. Contactez le support si nécessaire.">
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none opacity-70"
                  style={inputStyle}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Nom complet" id="fullName" icon={User}>
                  <input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    placeholder="Me Jean Dupont"
                    className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Nom du cabinet" id="cabinet" icon={Building2}>
                  <input
                    id="cabinet"
                    value={profile.cabinetName}
                    onChange={(e) => setProfile({ ...profile, cabinetName: e.target.value })}
                    placeholder="Dupont & Associés"
                    className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-white rounded-md cursor-pointer disabled:opacity-40"
                style={{ background: "var(--ink)" }}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "Enregistré" : "Enregistrer"}
              </button>
              {saved && !profileError && (
                <span
                  className="text-[12px]"
                  style={{ color: "var(--emerald, #2d6a4f)" }}
                >
                  Profil mis à jour avec succès
                </span>
              )}
              {profileError && (
                <span
                  role="alert"
                  className="text-[12px]"
                  style={{ color: "var(--bordeaux, #9b2226)" }}
                >
                  {profileError}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sécurité */}
        {activeTab === "securite" && (
          <div>
            <SectionHeader
              title="Changer le mot de passe"
              subtitle="Sécurisez votre compte avec un nouveau mot de passe."
            />

            <form onSubmit={handleChangePassword} className="space-y-5">
              <Field label="Mot de passe actuel" id="currentPassword" icon={Lock}>
                <input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  placeholder="Votre mot de passe actuel"
                  className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none"
                  style={inputStyle}
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Nouveau mot de passe" id="newPassword" icon={Lock}>
                  <input
                    id="newPassword"
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    placeholder="Minimum 6 caractères"
                    minLength={6}
                    required
                    className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Confirmer" id="confirmPassword" icon={Lock}>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="Confirmez le mot de passe"
                    required
                    className="w-full h-10 pl-9 pr-3 text-[13px] rounded-md outline-none"
                    style={inputStyle}
                  />
                </Field>
              </div>

              {passwordError && (
                <div
                  className="flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--bordeaux, #9b2226) 30%, transparent)",
                    background: "color-mix(in srgb, var(--bordeaux, #9b2226) 8%, transparent)",
                    color: "var(--bordeaux, #9b2226)",
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div
                  className="flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--emerald, #2d6a4f) 30%, transparent)",
                    background: "color-mix(in srgb, var(--emerald, #2d6a4f) 8%, transparent)",
                    color: "var(--emerald, #2d6a4f)",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Mot de passe mis à jour avec succès
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-white rounded-md cursor-pointer disabled:opacity-40"
                style={{ background: "var(--ink)" }}
              >
                {changingPassword ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
                Mettre à jour le mot de passe
              </button>
            </form>

            <div
              className="mt-10 pt-6"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                style={{ color: "var(--bordeaux, #9b2226)" }}
              >
                § Zone dangereuse
              </div>
              <p
                className="text-[13px] leading-relaxed max-w-xl mb-3"
                style={{ color: "var(--muted-foreground)" }}
              >
                La suppression du compte est irréversible. Toutes vos analyses, clients et données seront définitivement supprimés.
              </p>
              <button
                onClick={() =>
                  alert(
                    "Pour supprimer votre compte, contactez-nous à contact@datavocat.fr"
                  )
                }
                className="px-4 py-2 text-[12.5px] font-medium rounded-md cursor-pointer transition-colors"
                style={{
                  border: "1px solid color-mix(in srgb, var(--bordeaux, #9b2226) 40%, transparent)",
                  color: "var(--bordeaux, #9b2226)",
                  background: "transparent",
                }}
              >
                Supprimer mon compte
              </button>
            </div>
          </div>
        )}

        {/* Légal */}
        {activeTab === "legal" && (
          <div>
            <SectionHeader
              title="Informations légales"
              subtitle="Documents juridiques et réglementaires."
            />

            <div className="space-y-2">
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
                  className="group flex items-center justify-between p-4 rounded-md transition-colors"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                  }}
                >
                  <div>
                    <p
                      className="font-serif text-[15px] font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-[11.5px] mt-0.5"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                  <ExternalLink
                    className="h-4 w-4 transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </Link>
              ))}
            </div>

            <div
              className="mt-8 pt-6 text-[11px]"
              style={{
                color: "var(--muted-foreground)",
                borderTop: "1px solid var(--line)",
              }}
            >
              <p>Datavocat v2.0 — © {new Date().getFullYear()} Datavocat SAS</p>
              <p className="mt-1">
                Hébergé en France — Conforme RGPD — Données chiffrées
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

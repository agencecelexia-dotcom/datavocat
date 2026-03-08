"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Loader2,
  Trash2,
  Pencil,
  Building2,
  Phone,
  Mail,
  FileText,
  Users,
  Search,
} from "lucide-react";

interface Client {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  entreprise: string | null;
  notes: string | null;
  created_at: string;
  analyses_count?: number;
}

const emptyForm = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  entreprise: "",
  notes: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        // Fetch analyses count per client
        const countsRes = await fetch("/api/analyses?limit=1000");
        const analyses = countsRes.ok ? await countsRes.json() : [];
        const countMap: Record<string, number> = {};
        for (const a of analyses) {
          if (a.client_id) {
            countMap[a.client_id] = (countMap[a.client_id] || 0) + 1;
          }
        }
        setClients(
          data.map((c: Client) => ({
            ...c,
            analyses_count: countMap[c.id] || 0,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prenom.trim() || !form.nom.trim()) return;

    setSaving(true);
    try {
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setDialogOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchClients();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      prenom: client.prenom,
      nom: client.nom,
      email: client.email || "",
      telephone: client.telephone || "",
      entreprise: client.entreprise || "",
      notes: client.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openNewDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.prenom.toLowerCase().includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.entreprise?.toLowerCase().includes(q) ||
      c.telephone?.includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1e3a5f]">
            Clients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos clients et assignez-leur des analyses
          </p>
        </div>
        <Button onClick={openNewDialog} className="gap-2 cursor-pointer">
          <UserPlus className="h-4 w-4" />
          Nouveau client
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier le client" : "Nouveau client"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input
                    id="prenom"
                    value={form.prenom}
                    onChange={(e) =>
                      setForm({ ...form, prenom: e.target.value })
                    }
                    placeholder="Jean"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jean.dupont@exemple.fr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={form.telephone}
                  onChange={(e) =>
                    setForm({ ...form, telephone: e.target.value })
                  }
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entreprise">Entreprise</Label>
                <Input
                  id="entreprise"
                  value={form.entreprise}
                  onChange={(e) =>
                    setForm({ ...form, entreprise: e.target.value })
                  }
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes internes sur le client..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="cursor-pointer"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !form.prenom.trim() || !form.nom.trim()}
                  className="cursor-pointer"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      {clients.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="pl-10"
          />
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e3a5f]/5">
            <Users className="h-8 w-8 text-[#1e3a5f]/40" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Aucun client</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre premier client pour organiser vos analyses
            </p>
          </div>
          <Button onClick={openNewDialog} className="gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4" />
            Ajouter un client
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="group relative overflow-hidden p-4 transition-all duration-200 hover:shadow-md"
            >
              {/* Actions */}
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleEdit(client)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  disabled={deletingId === client.id}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {deletingId === client.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  )}
                </button>
              </div>

              {/* Client info */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f]/10 font-serif text-sm font-bold text-[#1e3a5f]">
                  {client.prenom[0]}
                  {client.nom[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">
                    {client.prenom} {client.nom}
                  </h3>
                  {client.entreprise && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{client.entreprise}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact details */}
              <div className="mt-3 space-y-1.5">
                {client.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <a
                      href={`mailto:${client.email}`}
                      className="truncate hover:text-foreground"
                    >
                      {client.email}
                    </a>
                  </div>
                )}
                {client.telephone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" />
                    <a
                      href={`tel:${client.telephone}`}
                      className="hover:text-foreground"
                    >
                      {client.telephone}
                    </a>
                  </div>
                )}
              </div>

              {/* Analyses count */}
              <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>
                  {client.analyses_count || 0} analyse
                  {(client.analyses_count || 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin-session";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Phone, Mail, Building2, ChevronRight, User, Pencil,
  Trash2, Loader2, Search, SlidersHorizontal, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/crm")({
  component: CRMPage,
  head: () => ({ meta: [{ title: "CRM — לידים ולקוחות" }] }),
});

export type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  source: string;
  stage: string;
  assigned_to: string | null;
  plan_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STAGES = [
  "ליד חדש",
  "שיחת סינון",
  "פגישת אסטרטגיה",
  "לקוח פעיל",
  "Upsell",
  "נסגר",
] as const;

/* per-stage accent colors */
const STAGE_META: Record<
  string,
  { dot: string; pill: string; col: string }
> = {
  "ליד חדש":          { dot: "bg-slate-400",  pill: "bg-slate-100 text-slate-700",     col: "border-t-slate-300" },
  "שיחת סינון":       { dot: "bg-blue-500",   pill: "bg-blue-100 text-blue-800",       col: "border-t-blue-400" },
  "פגישת אסטרטגיה":  { dot: "bg-violet-500", pill: "bg-violet-100 text-violet-800",   col: "border-t-violet-400" },
  "לקוח פעיל":        { dot: "bg-green-500",  pill: "bg-green-100 text-green-800",     col: "border-t-green-400" },
  "Upsell":           { dot: "bg-amber-500",  pill: "bg-amber-100 text-amber-800",     col: "border-t-amber-400" },
  "נסגר":             { dot: "bg-red-400",    pill: "bg-red-100 text-red-700",         col: "border-t-red-400" },
};

const SOURCES = ["ידני", "אורגני", "פרסום", "הפניה", "אחר"];
const TEAM_MEMBERS = ["ענב", "אוריאל", "דניאל"];

const EMPTY_FORM = {
  name: "", phone: "", email: "", business_name: "",
  source: "ידני", stage: "ליד חדש", assigned_to: "", notes: "",
};

function CRMPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("הכל");

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    setContacts((data ?? []) as Contact[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filterAssignee !== "הכל" && c.assigned_to !== filterAssignee) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.business_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
      );
    });
  }, [contacts, search, filterAssignee]);

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    STAGES.forEach((s) => { map[s] = []; });
    filtered.forEach((c) => {
      if (map[c.stage]) map[c.stage].push(c);
      else map["ליד חדש"].push(c);
    });
    return map;
  }, [filtered]);

  async function save() {
    if (!form.name.trim()) { toast.error("חובה שם"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      business_name: form.business_name.trim() || null,
      source: form.source,
      stage: form.stage,
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editContact) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", editContact.id);
      if (error) { toast.error(error.message); } else { toast.success("עודכן"); }
    } else {
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) { toast.error(error.message); } else { toast.success("נוצר ליד חדש"); }
    }
    setSaving(false);
    setShowAdd(false);
    setEditContact(null);
    setForm({ ...EMPTY_FORM });
    void load();
  }

  async function deleteContact(id: string) {
    if (!confirm("למחוק?")) return;
    await supabase.from("contacts").delete().eq("id", id);
    setDetailContact(null);
    void load();
  }

  async function moveStage(id: string, stage: string) {
    await supabase
      .from("contacts")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", id);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
  }

  function openEdit(c: Contact) {
    setForm({
      name: c.name, phone: c.phone ?? "", email: c.email ?? "",
      business_name: c.business_name ?? "", source: c.source,
      stage: c.stage, assigned_to: c.assigned_to ?? "", notes: c.notes ?? "",
    });
    setEditContact(c);
    setShowAdd(true);
    setDetailContact(null);
  }

  async function handleColumnDrop(stage: string) {
    if (!dragId) return;
    await moveStage(dragId, stage);
    setDragId(null);
    setDragOver(null);
  }

  if (loading) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      {/* ── Page header ────────────────────────────────────── */}
      <div className="border-b border-border bg-white px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              לידים ולקוחות
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              ניהול צינור המכירות ומעקב אחרי לידים
            </p>
          </div>

          {/* Search + filter + add */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש ליד..."
                className="h-9 w-52 border-border bg-white pe-9 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-9 w-36 border-border bg-white text-sm">
                <SlidersHorizontal className="me-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="הכל">כל האחראים</SelectItem>
                {TEAM_MEMBERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => { setForm({ ...EMPTY_FORM }); setEditContact(null); setShowAdd(true); }}
              className="h-9 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              ליד חדש
            </Button>
          </div>
        </div>

        {/* Stage stats strip */}
        <div className="mt-4 flex items-center gap-5 overflow-x-auto">
          {STAGES.map((s) => {
            const m = STAGE_META[s];
            const count = grouped[s]?.length ?? 0;
            return (
              <div key={s} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0", m.dot)} />
                <span className="text-xs text-muted-foreground">{s}</span>
                <span className="text-xs font-bold text-foreground">{count}</span>
              </div>
            );
          })}
          <div className="me-auto text-xs text-muted-foreground">
            {filtered.length} סה״כ
          </div>
        </div>
      </div>

      {/* ── Kanban board ───────────────────────────────────── */}
      <div className="overflow-x-auto px-5 py-5">
        <div className="flex min-w-max gap-3.5">
          {STAGES.map((stage) => {
            const m = STAGE_META[stage];
            const cards = grouped[stage] ?? [];
            const isOver = dragOver === stage;
            return (
              <div
                key={stage}
                className={cn(
                  "flex w-[248px] flex-shrink-0 flex-col rounded-2xl border-t-2 bg-white transition-all",
                  m.col,
                  isOver
                    ? "shadow-lg ring-2 ring-primary/30"
                    : "border border-border shadow-sm"
                )}
                style={isOver ? { borderTopColor: undefined } : undefined}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { void handleColumnDrop(stage); setDragOver(null); }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", m.dot)} />
                    <span className="text-sm font-semibold text-foreground">{stage}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {cards.length}
                    </span>
                    <button
                      onClick={() => {
                        setForm({ ...EMPTY_FORM, stage });
                        setEditContact(null);
                        setShowAdd(true);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {cards.map((c) => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      isDragging={dragId === c.id}
                      meta={m}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onClick={() => setDetailContact(c)}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      {dragId ? "שחרר כאן" : "אין לידים בשלב זה"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Add / Edit dialog ──────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditContact(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editContact ? "עריכת איש קשר" : "ליד חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שם מלא *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ישראל ישראלי" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">עסק</label>
                <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="שם העסק" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">טלפון</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" dir="ltr" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מייל</label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mail@example.com" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מקור</label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שלב</label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">אחראי</label>
                <Select value={form.assigned_to || "_none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {TEAM_MEMBERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">הערות</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="הערות..."
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditContact(null); }}>ביטול</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {editContact ? "עדכן" : "צור ליד"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contact detail panel ───────────────────────────── */}
      {detailContact && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setDetailContact(null)}
        >
          <div
            className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      STAGE_META[detailContact.stage]?.pill
                    )}
                  >
                    {detailContact.stage}
                  </span>
                  <span className="text-xs text-muted-foreground">{detailContact.source}</span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-foreground">{detailContact.name}</h2>
                {detailContact.business_name && (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {detailContact.business_name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetailContact(null)}
                className="mt-1 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Stage pipeline */}
              <div className="border-b border-border px-6 py-4">
                <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  שלב בפייפליין
                </div>
                <div className="flex flex-col gap-1.5">
                  {STAGES.map((s, i) => {
                    const active = detailContact.stage === s;
                    const passed = STAGES.indexOf(detailContact.stage as typeof STAGES[number]) > i;
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          void moveStage(detailContact.id, s).then(() =>
                            setDetailContact({ ...detailContact, stage: s })
                          )
                        }
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all text-right",
                          active
                            ? "bg-primary text-primary-foreground"
                            : passed
                            ? "text-muted-foreground/60 hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full flex-shrink-0",
                            active
                              ? "bg-white"
                              : passed
                              ? "bg-muted-foreground/30"
                              : STAGE_META[s]?.dot
                          )}
                        />
                        {s}
                        {active && <ChevronRight className="me-auto h-3.5 w-3.5 opacity-70 rtl:rotate-180" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-3 px-6 py-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  פרטי קשר
                </div>
                <div className="space-y-2 rounded-xl border border-border p-4">
                  {detailContact.phone && (
                    <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="טלפון">
                      <a href={`tel:${detailContact.phone}`} className="text-primary hover:underline" dir="ltr">
                        {detailContact.phone}
                      </a>
                    </InfoRow>
                  )}
                  {detailContact.email && (
                    <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="מייל">
                      <a href={`mailto:${detailContact.email}`} className="text-primary hover:underline" dir="ltr">
                        {detailContact.email}
                      </a>
                    </InfoRow>
                  )}
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label="אחראי">
                    {detailContact.assigned_to ?? "—"}
                  </InfoRow>
                  <InfoRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="מקור">
                    {detailContact.source}
                  </InfoRow>
                </div>

                {detailContact.notes && (
                  <div className="rounded-xl border border-border p-4">
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      הערות
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{detailContact.notes}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  נוצר: {new Date(detailContact.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
            </div>

            {/* Panel footer */}
            <div className="flex items-center gap-2 border-t border-border px-6 py-4">
              <Button size="sm" onClick={() => openEdit(detailContact)}>
                <Pencil className="ms-1.5 h-3.5 w-3.5" />
                עריכה
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void deleteContact(detailContact.id)}
              >
                <Trash2 className="ms-1.5 h-3.5 w-3.5" />
                מחיקה
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ── Sub-components ───────────────────────────────────── */

function ContactCard({
  contact, isDragging, meta, onDragStart, onDragEnd, onClick,
}: {
  contact: Contact;
  isDragging: boolean;
  meta: { dot: string; pill: string };
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-xl border border-border bg-white p-3.5 transition-all",
        "hover:border-primary/25 hover:shadow-md hover:-translate-y-0.5",
        isDragging && "opacity-40 shadow-lg rotate-1"
      )}
    >
      {/* Name + source */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{contact.name}</div>
          {contact.business_name && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{contact.business_name}</span>
            </div>
          )}
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground">
          {contact.source}
        </span>
      </div>

      {/* Footer row */}
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 hover:text-primary"
          >
            <Phone className="h-3 w-3" />
            {contact.phone}
          </a>
        )}
        {contact.assigned_to && (
          <span className="me-auto flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-primary">
            <User className="h-3 w-3" />
            {contact.assigned_to}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-12 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

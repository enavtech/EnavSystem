import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
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
  Plus, Phone, Mail, Building2, X, Loader2, Search, MapPin,
  Globe, Instagram, Facebook, UserCheck, ChevronRight, Pencil,
  Trash2, Zap, ExternalLink, Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/crm")({
  component: CRMPage,
  head: () => ({ meta: [{ title: "לידים" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Business details
  industry: string | null;
  business_type: string | null;
  service_type: string | null;
  city: string | null;
  website: string | null;
  employees_count: number | null;
  initial_revenue: string | null;
  monthly_fee: string | null;
  monthly_ad_budget: string | null;
  business_goals: string | null;
  // Legal
  id_number: string | null;
  tax_id: string | null;
  // Social
  instagram_handle: string | null;
  facebook_url: string | null;
  tiktok_handle: string | null;
  // Client
  client_status: string | null;
  client_since: string | null;
  // Meta Lead Ads
  meta_lead_id: string | null;
  form_name: string | null;
  ad_name: string | null;
  campaign_name: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "ליד חדש",
  "שיחת סינון",
  "פגישת אסטרטגיה",
  "לקוח פעיל",
  "Upsell",
  "נסגר",
] as const;

type Stage = typeof STAGES[number];

const STAGE_META: Record<Stage, { color: string; bg: string; border: string }> = {
  "ליד חדש":          { color: "#64748b", bg: "#64748b12", border: "#64748b40" },
  "שיחת סינון":       { color: "#3b82f6", bg: "#3b82f612", border: "#3b82f640" },
  "פגישת אסטרטגיה":  { color: "#8b5cf6", bg: "#8b5cf612", border: "#8b5cf640" },
  "לקוח פעיל":        { color: "#10b981", bg: "#10b98112", border: "#10b98140" },
  "Upsell":           { color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b40" },
  "נסגר":             { color: "#ef4444", bg: "#ef444412", border: "#ef444440" },
};

const SOURCES = ["ידני", "מטא", "אורגני", "פרסום", "הפניה", "אחר"];
const TEAM_MEMBERS = ["ענב", "אוריאל", "דניאל"];

const EMPTY_FORM = {
  name: "", phone: "", email: "", business_name: "",
  source: "ידני", stage: "ליד חדש" as Stage, assigned_to: "", notes: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function CRMPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .neq("stage", "לקוח פעיל")
      .order("created_at", { ascending: false });
    setContacts((data ?? []) as Contact[]);
    setLoading(false);
  }

  const selected = useMemo(() => contacts.find(c => c.id === selectedId) ?? null, [contacts, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(c => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.business_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
      );
    });
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    STAGES.forEach(s => { map[s] = []; });
    filtered.forEach(c => {
      if (c.stage === "לקוח פעיל") return; // clients are in /clients
      if (map[c.stage]) map[c.stage].push(c);
      else map["ליד חדש"].push(c);
    });
    return map;
  }, [filtered]);

  async function saveNew() {
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
      if (error) toast.error(error.message); else toast.success("עודכן");
    } else {
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) toast.error(error.message); else toast.success("ליד נוצר");
    }
    setSaving(false);
    setShowAdd(false);
    setEditContact(null);
    setForm({ ...EMPTY_FORM });
    void load();
  }

  // Auto-save single field for selected lead
  const saveField = useCallback(async (id: string, patch: Partial<Contact>) => {
    await supabase.from("contacts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  async function deleteContact(id: string) {
    if (!confirm("למחוק ליד זה לצמיתות?")) return;
    await supabase.from("contacts").delete().eq("id", id);
    setSelectedId(null);
    void load();
  }

  async function moveStage(id: string, stage: string) {
    await supabase.from("contacts").update({ stage, updated_at: new Date().toISOString() }).eq("id", id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
  }

  async function convertToClient(contact: Contact) {
    if (!confirm(`להמיר את "${contact.name}" ללקוח פעיל?`)) return;
    setConverting(true);
    const { error } = await supabase.from("contacts").update({
      stage: "לקוח פעיל",
      client_status: "active",
      client_since: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq("id", contact.id);
    setConverting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${contact.name} הועבר ללקוחות!`);
    setSelectedId(null);
    void load();
    navigate({ to: "/clients" });
  }

  async function handleColumnDrop(stage: string) {
    if (!dragId) return;
    if (stage === "לקוח פעיל") { toast.error("השתמש בכפתור 'המרה ללקוח' בכרטיסיית הליד"); setDragId(null); setDragOver(null); return; }
    await moveStage(dragId, stage);
    setDragId(null); setDragOver(null);
  }

  if (loading) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  const nonClientStages = STAGES.filter(s => s !== "לקוח פעיל");

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background px-6 py-4" style={{ direction: "rtl" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">לידים</h1>
            <p className="text-sm text-muted-foreground">צינור מכירות ומעקב לידים</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש..." className="h-9 w-48 pe-9 text-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button size="sm" className="cursor-pointer h-9 gap-1.5"
              onClick={() => { setForm({ ...EMPTY_FORM }); setEditContact(null); setShowAdd(true); }}>
              <Plus className="h-4 w-4" /> ליד חדש
            </Button>
          </div>
        </div>

        {/* Stage stats */}
        <div className="mt-3 flex items-center gap-4 overflow-x-auto">
          {nonClientStages.map(s => {
            const m = STAGE_META[s];
            const count = grouped[s]?.length ?? 0;
            return (
              <div key={s} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-xs text-muted-foreground">{s}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{count}</span>
              </div>
            );
          })}
          <span className="ms-auto text-xs text-muted-foreground">{filtered.filter(c => c.stage !== "לקוח פעיל").length} סה״כ</span>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex" style={{ direction: "rtl" }}>

        {/* Kanban board */}
        <div className={cn("flex-1 overflow-x-auto px-4 py-5 transition-all", selectedId && "hidden lg:block lg:w-[calc(100%-480px)]")}>
          <div className="flex gap-3">
            {nonClientStages.map(stage => {
              const m = STAGE_META[stage];
              const cards = grouped[stage] ?? [];
              const isOver = dragOver === stage;
              return (
                <div key={stage}
                  className={cn("flex w-[230px] flex-shrink-0 flex-col rounded-2xl border bg-card transition-all",
                    isOver ? "ring-2" : "")}
                  style={{
                    borderTopWidth: 2,
                    borderTopColor: m.color,
                    ...(isOver ? { boxShadow: `0 0 0 2px ${m.color}55` } : {}),
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => { void handleColumnDrop(stage); }}
                >
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 5px ${m.color}80` }} />
                      <span className="text-sm font-semibold">{stage}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="glass-subtle rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {cards.length}
                      </span>
                      <button onClick={() => { setForm({ ...EMPTY_FORM, stage }); setEditContact(null); setShowAdd(true); }}
                        className="cursor-pointer flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
                    {cards.map(c => {
                      const isSelected = selectedId === c.id;
                      return (
                        <div key={c.id}
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                          onClick={() => setSelectedId(isSelected ? null : c.id)}
                          className={cn(
                            "group cursor-pointer rounded-xl border bg-background p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px]",
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
                            dragId === c.id && "opacity-40 scale-95"
                          )}
                          style={isSelected ? { borderColor: m.color, boxShadow: `0 0 0 2px ${m.color}25` } : {}}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
                              {c.business_name && (
                                <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {c.business_name}
                                </div>
                              )}
                            </div>
                            {c.meta_lead_id && (
                              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                style={{ background: "#1877f218", color: "#1877f2" }}>META</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                            {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                          </div>
                          {c.assigned_to && (
                            <div className="mt-1.5 text-[10px] text-muted-foreground/60">← {c.assigned_to}</div>
                          )}
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-border py-6 text-center text-xs text-muted-foreground/50">
                        {dragId ? "שחרר כאן" : "אין לידים"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Detail panel ──────────────────────────────────────── */}
        {selectedId && selected && (
          <LeadDetail
            contact={selected}
            onClose={() => setSelectedId(null)}
            onSaveField={(patch) => saveField(selected.id, patch)}
            onMoveStage={(stage) => moveStage(selected.id, stage)}
            onConvert={() => convertToClient(selected)}
            onDelete={() => deleteContact(selected.id)}
            onEditBasic={() => {
              setForm({
                name: selected.name, phone: selected.phone ?? "",
                email: selected.email ?? "", business_name: selected.business_name ?? "",
                source: selected.source, stage: selected.stage as Stage,
                assigned_to: selected.assigned_to ?? "", notes: selected.notes ?? "",
              });
              setEditContact(selected);
              setShowAdd(true);
            }}
            converting={converting}
          />
        )}
      </div>

      {/* ── Add / Edit dialog ──────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={o => { if (!o) { setShowAdd(false); setEditContact(null); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editContact ? "עריכה בסיסית" : "ליד חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שם מלא *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ישראל ישראלי" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שם עסק</label>
                <Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="שם העסק" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">טלפון</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" dir="ltr" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מייל</label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="mail@example.com" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מקור</label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שלב</label>
                <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{nonClientStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">אחראי</label>
                <Select value={form.assigned_to || "__none__"} onValueChange={v => setForm({ ...form, assigned_to: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {TEAM_MEMBERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">הערות ראשוניות</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="הערות..." className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => { setShowAdd(false); setEditContact(null); }}>ביטול</Button>
            <Button className="cursor-pointer" onClick={saveNew} disabled={saving}>
              {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {editContact ? "שמור" : "צור ליד"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Lead detail panel ────────────────────────────────────────────────────────

function LeadDetail({ contact, onClose, onSaveField, onMoveStage, onConvert, onDelete, onEditBasic, converting }: {
  contact: Contact;
  onClose: () => void;
  onSaveField: (patch: Partial<Contact>) => Promise<void>;
  onMoveStage: (stage: string) => void;
  onConvert: () => void;
  onDelete: () => void;
  onEditBasic: () => void;
  converting: boolean;
}) {
  // Local state per-field for controlled inputs with onBlur save
  const [f, setF] = useState<Partial<Contact>>({});

  // Reset local state when contact changes
  useEffect(() => { setF({}); }, [contact.id]);

  function val(key: keyof Contact): string {
    return String(f[key] !== undefined ? f[key] : (contact[key] ?? ""));
  }

  function change(key: keyof Contact, v: string) {
    setF(prev => ({ ...prev, [key]: v }));
  }

  async function blur(key: keyof Contact) {
    if (f[key] === undefined) return;
    const v = f[key];
    if (v === (contact[key] ?? "")) return;
    await onSaveField({ [key]: (v === "" ? null : v) } as Partial<Contact>);
  }

  function Field({ label, field, placeholder, dir: d }: { label: string; field: keyof Contact; placeholder?: string; dir?: "ltr" | "rtl" }) {
    return (
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</label>
        <Input
          value={val(field)}
          onChange={e => change(field, e.target.value)}
          onBlur={() => void blur(field)}
          placeholder={placeholder}
          dir={d}
          className="h-9 bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
        />
      </div>
    );
  }

  const stageMeta = STAGE_META[contact.stage as Stage] ?? STAGE_META["ליד חדש"];
  const nonClientStages = STAGES.filter(s => s !== "לקוח פעיל");

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-start bg-black/25 backdrop-blur-[2px] lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:backdrop-blur-none"
      onClick={e => { if (e.currentTarget === e.target) onClose(); }}
      style={{ direction: "rtl" }}
    >
      <div className="flex w-full max-w-[480px] flex-col overflow-hidden bg-background shadow-2xl lg:border-r lg:border-border lg:shadow-none"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: stageMeta.bg, color: stageMeta.color, border: `1px solid ${stageMeta.border}` }}>
                  {contact.stage}
                </span>
                {contact.meta_lead_id && (
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: "#1877f215", color: "#1877f2", border: "1px solid #1877f230" }}>
                    META · {contact.form_name ?? "ליד"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{contact.source}</span>
              </div>
              <h2 className="mt-1.5 truncate text-lg font-bold text-foreground">{contact.name}</h2>
              {contact.business_name && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />{contact.business_name}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onEditBasic} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClose} className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Convert CTA */}
          <Button className="mt-3 w-full cursor-pointer gap-2" onClick={onConvert} disabled={converting}
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            המרה ללקוח פעיל
          </Button>
        </div>

        {/* Pipeline stepper */}
        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {nonClientStages.map((s, i) => {
              const m = STAGE_META[s];
              const isActive = contact.stage === s;
              const isPast = nonClientStages.indexOf(contact.stage as typeof nonClientStages[number]) > i;
              return (
                <div key={s} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />}
                  <button
                    onClick={() => onMoveStage(s)}
                    className={cn(
                      "cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                      isActive ? "text-white font-semibold" : isPast ? "text-muted-foreground/50 hover:opacity-80" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    style={isActive ? { background: m.color } : {}}
                  >
                    {s}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Contact info */}
          <section>
            <SectionTitle icon={<Phone className="h-3.5 w-3.5" />} title="פרטי קשר" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם מלא" field="name" />
              <Field label="שם עסק" field="business_name" />
              <Field label="טלפון" field="phone" dir="ltr" placeholder="050-0000000" />
              <Field label="מייל" field="email" dir="ltr" placeholder="mail@example.com" />
              <Field label="עיר" field="city" placeholder="תל אביב" />
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">אחראי</label>
                <Select value={contact.assigned_to ?? "__none__"}
                  onValueChange={v => void onSaveField({ assigned_to: v === "__none__" ? null : v })}>
                  <SelectTrigger className="h-9 bg-muted/50 text-sm cursor-pointer border-muted-foreground/20"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {TEAM_MEMBERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Business details */}
          <section>
            <SectionTitle icon={<Building2 className="h-3.5 w-3.5" />} title="פרטים עסקיים" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="סוג עסק" field="business_type" placeholder="בע״מ / עצמאי" />
              <Field label="תחום עיסוק" field="industry" placeholder="נדל״ן, מסחר…" />
              <Field label="סוג שירות מבוקש" field="service_type" placeholder="ניהול מדיה, SEO…" />
              <Field label="מספר עובדים" field="employees_count" placeholder="10" />
              <Field label="הכנסה ראשונית" field="initial_revenue" placeholder="₪5,000" />
              <Field label="תקציב פרסום חודשי" field="monthly_ad_budget" placeholder="₪3,000" />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">יעדים עסקיים</label>
              <Textarea
                value={val("business_goals")}
                onChange={e => change("business_goals", e.target.value)}
                onBlur={() => void blur("business_goals")}
                placeholder="מה הם רוצים להשיג?"
                className="min-h-[60px] bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
              />
            </div>
          </section>

          {/* Social */}
          <section>
            <SectionTitle icon={<Globe className="h-3.5 w-3.5" />} title="נוכחות דיגיטלית" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">אתר אינטרנט</label>
                <div className="flex items-center gap-1">
                  <Input value={val("website")} onChange={e => change("website", e.target.value)} onBlur={() => void blur("website")}
                    placeholder="www.example.com" dir="ltr" className="h-9 flex-1 bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background" />
                  {contact.website && (
                    <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <Instagram className="h-3 w-3" /> אינסטגרם
                </label>
                <Input value={val("instagram_handle")} onChange={e => change("instagram_handle", e.target.value)}
                  onBlur={() => void blur("instagram_handle")} placeholder="@handle" dir="ltr" className="h-9 bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <Facebook className="h-3 w-3" /> פייסבוק
                </label>
                <Input value={val("facebook_url")} onChange={e => change("facebook_url", e.target.value)}
                  onBlur={() => void blur("facebook_url")} placeholder="facebook.com/page" dir="ltr" className="h-9 bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background" />
              </div>
              <Field label="טיקטוק" field="tiktok_handle" dir="ltr" placeholder="@handle" />
            </div>
          </section>

          {/* Meta source info */}
          {contact.meta_lead_id && (
            <section>
              <SectionTitle icon={<Zap className="h-3.5 w-3.5" />} title="מקור מטא" />
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                {contact.campaign_name && <div className="flex justify-between"><span className="text-xs text-muted-foreground">קמפיין</span><span className="text-xs font-medium">{contact.campaign_name}</span></div>}
                {contact.ad_name && <div className="flex justify-between"><span className="text-xs text-muted-foreground">מודעה</span><span className="text-xs font-medium">{contact.ad_name}</span></div>}
                {contact.form_name && <div className="flex justify-between"><span className="text-xs text-muted-foreground">טופס</span><span className="text-xs font-medium">{contact.form_name}</span></div>}
                <div className="flex justify-between"><span className="text-xs text-muted-foreground">Lead ID</span><span className="font-mono text-[10px] text-muted-foreground">{contact.meta_lead_id}</span></div>
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <SectionTitle icon={<Users className="h-3.5 w-3.5" />} title="הערות" />
            <Textarea
              value={val("notes")}
              onChange={e => change("notes", e.target.value)}
              onBlur={() => void blur("notes")}
              placeholder="רשום כאן כל פרט רלוונטי מהשיחה…"
              className="min-h-[100px] bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
            />
          </section>

          {/* Created */}
          <div className="text-[11px] text-muted-foreground/50 pb-2">
            נוצר: {new Date(contact.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="text-muted-foreground/70">{icon}</span>
      {title}
      <span className="flex-1 border-t border-border/60" />
    </div>
  );
}

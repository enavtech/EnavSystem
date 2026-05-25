import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fbGetContacts, fbGetStageCodes, fbUpdateContact, fbCreateContact,
  fbDeleteContact, fbToContact, contactPatchToFb,
  fbGetContactFull, FB_FIELD_LABELS,
} from "@/lib/fireberry-api";
import { isAdmin } from "@/lib/admin-session";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Phone, Building2, X, Loader2, Search, MapPin,
  Globe, UserCheck, ChevronRight, Pencil,
  Trash2, Zap, ExternalLink, Users, Settings2, ArrowUp, ArrowDown,
  CalendarDays, ChevronDown, AlertCircle, TrendingUp, Clock,
  MessageSquare, Mail, MessageCircle, ArrowRightLeft,
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
  // Editable lead date
  lead_date: string | null;
  // Fireberry extended fields
  lost_reason?: string | null;
  extended_notes?: string | null;
  // Business metrics (pcf fields)
  incorporation_type: string | null;
  conversion_rate: number | null;
  turnover: number | null;
  cashflow: number | null;
  operating_profit: number | null;
  avg_deal: number | null;
  capacity_pct: number | null;
  turnover_target: number | null;
  cashflow_target: number | null;
  turnover_gap: number | null;
  cashflow_gap: number | null;
  source_conversion_rate: number | null;
  operating_expenses: number | null;
  leads_fb: number | null;
};

// ─── Activity types ────────────────────────────────────────────────────────────

export type ActivityType = "call" | "whatsapp" | "email" | "note" | "stage_change" | "meeting" | "conversion";

export type Activity = {
  id: string;
  contact_id: string;
  type: ActivityType;
  content: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CLIENT_STAGE = "לקוח פעיל"; // fixed — used for conversion, never editable

const DEFAULT_STAGES = ["ליד חדש", "שיחת סינון", "פגישת אסטרטגיה", "Upsell", "נסגר"];

// Colors assigned by position — stable regardless of stage name
const STAGE_COLORS = [
  { color: "#64748b", bg: "#64748b12", border: "#64748b40" },
  { color: "#3b82f6", bg: "#3b82f612", border: "#3b82f640" },
  { color: "#8b5cf6", bg: "#8b5cf612", border: "#8b5cf640" },
  { color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b40" },
  { color: "#ef4444", bg: "#ef444412", border: "#ef444440" },
  { color: "#06b6d4", bg: "#06b6d412", border: "#06b6d440" },
  { color: "#10b981", bg: "#10b98112", border: "#10b98140" },
  { color: "#ec4899", bg: "#ec489912", border: "#ec489940" },
];

function stageColor(idx: number) {
  return STAGE_COLORS[idx % STAGE_COLORS.length];
}

const SOURCES = ["ידני", "מטא", "אורגני", "פרסום", "הפניה", "אחר"];
const TEAM_MEMBERS = ["ענב", "אוריאל", "דניאל"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

const EMPTY_FORM = {
  name: "", phone: "", email: "", business_name: "",
  source: "ידני", stage: DEFAULT_STAGES[0], assigned_to: "", notes: "",
  lead_date: todayStr(),
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
  const [search,         setSearch]         = useState("");
  const [stages,         setStages]         = useState<string[]>(DEFAULT_STAGES);
  const [stageCodes,     setStageCodes]     = useState<{ code: number; name: string }[]>([]);
  const [showStages,     setShowStages]     = useState(false);
  const [settingsId,     setSettingsId]     = useState<number | null>(null);
  const [dateFilter,     setDateFilter]     = useState<"all"|"today"|"yesterday"|"7days"|"thisMonth"|"prevMonth"|"custom">("all");
  const [customFrom,     setCustomFrom]     = useState("");
  const [customTo,       setCustomTo]       = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [sourceFilter,   setSourceFilter]   = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [activities,        setActivities]        = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [selectedRaw,       setSelectedRaw]       = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  useEffect(() => {
    if (!selectedId) { setActivities([]); setSelectedRaw({}); return; }
    setActivitiesLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).from("activities").select("*")
      .eq("contact_id", selectedId)
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Activity[] | null }) => {
        setActivities(data ?? []);
        setActivitiesLoading(false);
      });
    void fbGetContactFull({ data: { id: selectedId } }).then(raw => {
      setSelectedRaw(raw as Record<string, unknown>);
    }).catch(() => {});
  }, [selectedId]);

  async function load() {
    setLoading(true);
    const [contactsRes, stageCodesRes, settingsRes] = await Promise.all([
      fbGetContacts({ data: { pageSize: 500, excludeClients: true } }),
      fbGetStageCodes(),
      supabase.from("app_settings").select("id,lead_stages").limit(1).single(),
    ]);
    setContacts((contactsRes.data ?? []).map(fbToContact) as Contact[]);
    const codes = stageCodesRes.stages ?? [];
    setStageCodes(codes);
    const leadStages = codes.filter(s => !s.name.includes("לקוח")).map(s => s.name);
    if (leadStages.length > 0) setStages(leadStages);
    if (settingsRes.data) setSettingsId(settingsRes.data.id);
    setLoading(false);
  }

  const selected = useMemo(() => contacts.find(c => c.id === selectedId) ?? null, [contacts, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate()-1);
    const yesterdayEnd   = new Date(todayStart); yesterdayEnd.setMilliseconds(-1);
    const weekAgo        = new Date(todayStart); weekAgo.setDate(weekAgo.getDate()-7);
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    return contacts.filter(c => {
      if (q && !c.name.toLowerCase().includes(q) &&
          !(c.business_name ?? "").toLowerCase().includes(q) &&
          !(c.phone ?? "").includes(q)) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (assignedFilter === "none" && c.assigned_to) return false;
      if (assignedFilter !== "all" && assignedFilter !== "none" && c.assigned_to !== assignedFilter) return false;
      if (dateFilter !== "all") {
        const d = new Date(c.lead_date ?? c.created_at);
        if (dateFilter === "today"     && d < todayStart)                              return false;
        if (dateFilter === "yesterday" && (d < yesterdayStart || d > yesterdayEnd))    return false;
        if (dateFilter === "7days"     && d < weekAgo)                                 return false;
        if (dateFilter === "thisMonth" && d < monthStart)                              return false;
        if (dateFilter === "prevMonth" && (d < prevMonthStart || d > prevMonthEnd))    return false;
        if (dateFilter === "custom") {
          if (customFrom && d < new Date(customFrom + "T00:00:00")) return false;
          if (customTo   && d > new Date(customTo   + "T23:59:59")) return false;
        }
      }
      return true;
    });
  }, [contacts, search, dateFilter, customFrom, customTo, sourceFilter, assignedFilter]);

  const kpis = useMemo(() => {
    const now = new Date();
    const weekAgo  = new Date(now.getTime() - 7  * 86400000).toISOString();
    const staleAgo = new Date(now.getTime() - 5  * 86400000).toISOString();
    const allLeads = contacts;
    const lastStages = stages.slice(-2);
    return {
      total:      allLeads.length,
      newWeek:    allLeads.filter(c => c.created_at >= weekAgo).length,
      stale:      allLeads.filter(c => c.updated_at < staleAgo).length,
      hot:        allLeads.filter(c => lastStages.includes(c.stage)).length,
    };
  }, [contacts, stages]);

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    stages.forEach(s => { map[s] = []; });
    filtered.forEach(c => {
      if (c.stage === CLIENT_STAGE) return;
      if (map[c.stage]) map[c.stage].push(c);
      else map[stages[0]]?.push(c); // orphan → first stage
    });
    return map;
  }, [filtered, stages]);

  async function saveNew() {
    if (!form.name.trim()) { toast.error("חובה שם"); return; }
    setSaving(true);
    const stageCode = stageCodes.find(s => s.name === form.stage)?.code;
    try {
      if (editContact) {
        const fbPatch: Record<string, unknown> = {
          accountname: form.name.trim(),
          telephone1: form.phone.trim() || null,
          emailaddress1: form.email.trim() || null,
          ...(stageCode ? { statuscode: stageCode } : {}),
        };
        await fbUpdateContact({ data: { id: editContact.id, patch: fbPatch } });
        toast.success("עודכן");
      } else {
        await fbCreateContact({ data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          statuscode: stageCode,
        }});
        toast.success("ליד נוצר");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה");
    }
    setSaving(false);
    setShowAdd(false);
    setEditContact(null);
    setForm({ ...EMPTY_FORM });
    void load();
  }

  // Auto-save single field for selected lead
  const saveField = useCallback(async (id: string, patch: Partial<Contact>) => {
    const fbPatch = contactPatchToFb(patch as Record<string, unknown>);
    if (Object.keys(fbPatch).length > 0) {
      await fbUpdateContact({ data: { id, patch: fbPatch } });
    }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  async function deleteContact(id: string) {
    if (!confirm("למחוק ליד זה לצמיתות?")) return;
    await fbDeleteContact({ data: { id } });
    setSelectedId(null);
    void load();
  }

  async function addActivity(contactId: string, type: ActivityType, content: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("activities").insert({
      contact_id: contactId,
      type,
      content: content || null,
    }).select().single() as { data: Activity | null };
    if (data && selectedId === contactId) {
      setActivities(prev => [data, ...prev]);
    }
  }

  async function moveStage(id: string, stage: string) {
    const prevStage = contacts.find(c => c.id === id)?.stage;
    const code = stageCodes.find(s => s.name === stage)?.code;
    if (!code) { toast.error(`שלב "${stage}" לא נמצא`); return; }
    await fbUpdateContact({ data: { id, patch: { statuscode: code } } });
    setContacts(prev => prev.map(c => c.id === id ? { ...c, stage } : c));
    if (prevStage && prevStage !== stage) {
      void addActivity(id, "stage_change", `${prevStage} ← ${stage}`);
    }
  }

  async function convertToClient(contact: Contact) {
    if (!confirm(`להמיר את "${contact.name}" ללקוח פעיל?`)) return;
    setConverting(true);
    const clientCode = stageCodes.find(s => s.name.includes("לקוח"))?.code;
    if (!clientCode) {
      toast.error("לא נמצא שלב לקוח בפיירברי — ודא שיש שלב שמכיל 'לקוח'");
      setConverting(false);
      return;
    }
    await fbUpdateContact({ data: { id: contact.id, patch: { statuscode: clientCode } } });
    setConverting(false);
    void addActivity(contact.id, "conversion", `${contact.name} הומר ללקוח פעיל`);
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

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background px-6 py-4 space-y-3" style={{ direction: "rtl" }}>

        {/* Row 1: title + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">לידים</h1>
            <p className="text-sm text-muted-foreground">צינור מכירות ומעקב לידים</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש שם, טלפון..." className="h-9 w-52 pe-9 text-sm" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button size="sm" variant="ghost" className="cursor-pointer h-9 gap-1.5" onClick={() => setShowStages(true)}>
              <Settings2 className="h-4 w-4" /> שלבים
            </Button>
            <Button size="sm" className="cursor-pointer h-9 gap-1.5"
              onClick={() => { setForm({ ...EMPTY_FORM }); setEditContact(null); setShowAdd(true); }}>
              <Plus className="h-4 w-4" /> ליד חדש
            </Button>
          </div>
        </div>

        {/* Row 2: KPI chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "סה״כ לידים",      val: kpis.total,   icon: <Users className="h-3.5 w-3.5" />,       color: "text-foreground",     bg: "bg-muted/60" },
            { label: "חדשים השבוע",     val: kpis.newWeek, icon: <TrendingUp className="h-3.5 w-3.5" />,  color: "text-blue-600",       bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "ממתינים לטיפול", val: kpis.stale,   icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-amber-600",      bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "חמים (שלבים אחרונים)", val: kpis.hot, icon: <Zap className="h-3.5 w-3.5" />,      color: "text-emerald-600",    bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          ].map(k => (
            <div key={k.label} className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5", k.bg)}>
              <span className={k.color}>{k.icon}</span>
              <span className={cn("text-lg font-bold tabular-nums leading-none", k.color)}>{k.val}</span>
              <span className="text-[11px] text-muted-foreground">{k.label}</span>
            </div>
          ))}
        </div>

        {/* Row 3: date + source + assigned filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date filter pills */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <CalendarDays className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
            {([
              { key: "all",       label: "הכל" },
              { key: "today",     label: "היום" },
              { key: "yesterday", label: "אתמול" },
              { key: "7days",     label: "7 ימים" },
              { key: "thisMonth", label: "חודש זה" },
              { key: "prevMonth", label: "חודש קודם" },
              { key: "custom",    label: "מותאם" },
            ] as const).map(({ key, label }) => (
              <button key={key}
                onClick={() => { setDateFilter(key); setShowCustomDate(key === "custom"); }}
                className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  dateFilter === key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-7 rounded border-0 bg-transparent text-xs text-foreground outline-none" />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-7 rounded border-0 bg-transparent text-xs text-foreground outline-none" />
            </div>
          )}

          {/* Source filter */}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none">
            <option value="all">כל המקורות</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Assigned filter */}
          <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none">
            <option value="all">כל האחראים</option>
            <option value="none">לא משויך</option>
            {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Active filters badge */}
          {(dateFilter !== "all" || sourceFilter !== "all" || assignedFilter !== "all" || search) && (
            <button onClick={() => { setDateFilter("all"); setSourceFilter("all"); setAssignedFilter("all"); setSearch(""); setCustomFrom(""); setCustomTo(""); }}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> נקה פילטרים
            </button>
          )}
        </div>

      </div>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex" style={{ direction: "rtl" }}>

        {/* Kanban board */}
        <div className={cn("flex-1 overflow-x-auto px-4 py-5 transition-all", selectedId && "hidden lg:block lg:w-[calc(100%-480px)]")}>
          <div className="flex gap-3">
            {stages.map((stage, idx) => {
              const m = stageColor(idx);
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
                      const ageMs   = Date.now() - new Date(c.lead_date ?? c.created_at).getTime();
                      const ageDays = Math.floor(ageMs / 86400000);
                      const staleMs = Date.now() - new Date(c.updated_at).getTime();
                      const isStale = staleMs > 5 * 86400000;
                      return (
                        <div key={c.id}
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                          onClick={() => setSelectedId(isSelected ? null : c.id)}
                          className={cn(
                            "group cursor-pointer rounded-xl border bg-background p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px]",
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
                            isStale && !isSelected && "border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10",
                            dragId === c.id && "opacity-40 scale-95"
                          )}
                          style={isSelected ? { borderColor: m.color, boxShadow: `0 0 0 2px ${m.color}25` } : {}}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
                              {c.business_name && (
                                <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                                  <Building2 className="h-3 w-3 shrink-0" />{c.business_name}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {c.meta_lead_id && (
                                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                  style={{ background: "#1877f218", color: "#1877f2" }}>META</span>
                              )}
                              {isStale && (
                                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                  עומד
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {c.phone && (
                              <a href={`https://wa.me/972${c.phone.replace(/^0/, "").replace(/\D/g,"")}`}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-green-100 hover:text-green-700 transition-colors"
                                title="WhatsApp">
                                <Phone className="h-3 w-3" />{c.phone}
                              </a>
                            )}
                            {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            {c.assigned_to
                              ? <span className="text-[10px] text-muted-foreground/60">← {c.assigned_to}</span>
                              : <span />}
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                              <Clock className="h-2.5 w-2.5" />
                              {ageDays === 0 ? "היום" : ageDays === 1 ? "אתמול" : `${ageDays} ימים`}
                            </span>
                          </div>
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
            stages={stages}
            onClose={() => setSelectedId(null)}
            onSaveField={(patch) => saveField(selected.id, patch)}
            onMoveStage={(stage) => moveStage(selected.id, stage)}
            onConvert={() => convertToClient(selected)}
            onDelete={() => deleteContact(selected.id)}
            onEditBasic={() => {
              setForm({
                name: selected.name, phone: selected.phone ?? "",
                email: selected.email ?? "", business_name: selected.business_name ?? "",
                source: selected.source, stage: selected.stage,
                assigned_to: selected.assigned_to ?? "", notes: selected.notes ?? "",
                lead_date: selected.lead_date ?? todayStr(),
              });
              setEditContact(selected);
              setShowAdd(true);
            }}
            converting={converting}
            activities={activities}
            activitiesLoading={activitiesLoading}
            onAddActivity={(type, content) => addActivity(selected.id, type, content)}
            rawFields={selectedRaw}
          />
        )}
      </div>

      {/* ── Stages settings dialog ────────────────────────────── */}
      <StagesDialog
        open={showStages}
        stages={stages}
        settingsId={settingsId}
        onClose={() => setShowStages(false)}
        onSave={newStages => { setStages(newStages); void load(); }}
      />

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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">תאריך יצירת ליד</label>
                <Input type="date" value={form.lead_date} onChange={e => setForm({ ...form, lead_date: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מקור</label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שלב</label>
                <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

// ─── Activity metadata ────────────────────────────────────────────────────────

const ACTIVITY_TYPES: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "note",     label: "הערה",     icon: <MessageSquare className="h-3.5 w-3.5" />, color: "#64748b" },
  { type: "call",     label: "שיחה",     icon: <Phone className="h-3.5 w-3.5" />,         color: "#3b82f6" },
  { type: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" />, color: "#25d366" },
  { type: "email",    label: "מייל",     icon: <Mail className="h-3.5 w-3.5" />,          color: "#8b5cf6" },
  { type: "meeting",  label: "פגישה",    icon: <CalendarDays className="h-3.5 w-3.5" />,  color: "#6366f1" },
];

const ACTIVITY_META: Record<ActivityType, { icon: React.ReactNode; color: string; label: string }> = {
  call:         { icon: <Phone className="h-3.5 w-3.5" />,          color: "#3b82f6", label: "שיחה" },
  whatsapp:     { icon: <MessageCircle className="h-3.5 w-3.5" />,  color: "#25d366", label: "WhatsApp" },
  email:        { icon: <Mail className="h-3.5 w-3.5" />,           color: "#8b5cf6", label: "מייל" },
  note:         { icon: <MessageSquare className="h-3.5 w-3.5" />,  color: "#64748b", label: "הערה" },
  stage_change: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, color: "#f59e0b", label: "שינוי שלב" },
  meeting:      { icon: <CalendarDays className="h-3.5 w-3.5" />,   color: "#6366f1", label: "פגישה" },
  conversion:   { icon: <UserCheck className="h-3.5 w-3.5" />,      color: "#10b981", label: "המרה" },
};

function relativeTime(iso: string) {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `${diffMin}ד׳`;
  if (diffHr < 24) return `${diffHr}ש׳`;
  if (diffDay === 1) return "אתמול";
  return `${diffDay} ימים`;
}

// ─── Quick log ────────────────────────────────────────────────────────────────

function QuickLog({ onAdd }: { onAdd: (type: ActivityType, content: string) => Promise<void> }) {
  const [type, setType] = useState<ActivityType>("note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(type, content.trim());
    setContent("");
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ACTIVITY_TYPES.map(t => (
          <button key={t.type} onClick={() => setType(t.type)}
            className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer",
              type === t.type ? "text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted")}
            style={type === t.type ? { background: t.color } : {}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { void submit(); } }}
        placeholder="רשום פרטים… (Ctrl+Enter לשמירה)"
        className="min-h-[68px] bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background resize-none"
      />
      <Button size="sm" className="cursor-pointer w-full gap-1.5" onClick={submit} disabled={saving || !content.trim()}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        הוסף לוג
      </Button>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  if (loading) return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (!activities.length) return (
    <div className="rounded-xl border-2 border-dashed border-border py-6 text-center text-xs text-muted-foreground/50">
      אין פעילות עדיין
    </div>
  );

  return (
    <div className="space-y-1">
      {activities.map((a, idx) => {
        const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.note;
        return (
          <div key={a.id} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${meta.color}18`, color: meta.color, border: `1.5px solid ${meta.color}35` }}>
                {meta.icon}
              </div>
              {idx < activities.length - 1 && (
                <div className="my-1 flex-1 w-px bg-border/40" style={{ minHeight: 10 }} />
              )}
            </div>
            <div className="flex-1 pb-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">{relativeTime(a.created_at)}</span>
              </div>
              {a.content && (
                <p className="mt-0.5 text-xs text-foreground/80 leading-relaxed break-words whitespace-pre-wrap">{a.content}</p>
              )}
              {a.created_by && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/50">← {a.created_by}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Standalone field — must live outside LeadDetail to avoid focus loss ──────

function LeadField({ label, value, onChange, onBlur, placeholder, dir: d }: {
  label: string; value: string;
  onChange: (v: string) => void; onBlur: () => void;
  placeholder?: string; dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        placeholder={placeholder} dir={d}
        className="h-9 bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
      />
    </div>
  );
}

// ─── Lead detail panel ────────────────────────────────────────────────────────

// Fields already shown as editable inputs — excluded from raw section
const FORM_FIELDS_SHOWN = new Set([
  "_id", "accountid", "accountname", "telephone1", "emailaddress1",
  "statuscode", "status", "ownerid", "ownerid_fullname", "ownername", "createdon", "modifiedon",
  "billingcity", "websiteurl", "numberofemployees", "industrycode", "businesstypecode",
  "idnumber", "needs", "description", "lostreason", "revenue",
  "originatingleadcode", "originatinglead", "industry", "pcfsystemfield167name",
  "pcfsystemfield108", "pcfsystemfield117", "pcfsystemfield128", "pcfsystemfield149", "pcfsystemfield167",
  // Metrics
  "pcfsystemfield107", "pcfsystemfield129", "pcfsystemfield130", "pcfsystemfield131",
  "pcfsystemfield132", "pcfsystemfield134", "pcfsystemfield135", "pcfsystemfield136",
  "pcfsystemfield137", "pcfsystemfield138", "pcfsystemfield139", "pcfsystemfield140",
  "pcfsystemfield156", "pcfsystemfield163",
]);

function LeadDetail({ contact, stages, onClose, onSaveField, onMoveStage, onConvert, onDelete, onEditBasic, converting, activities, activitiesLoading, onAddActivity, rawFields }: {
  contact: Contact;
  stages: string[];
  onClose: () => void;
  onSaveField: (patch: Partial<Contact>) => Promise<void>;
  onMoveStage: (stage: string) => void;
  onConvert: () => void;
  onDelete: () => void;
  onEditBasic: () => void;
  converting: boolean;
  activities: Activity[];
  activitiesLoading: boolean;
  onAddActivity: (type: ActivityType, content: string) => Promise<void>;
  rawFields: Record<string, unknown>;
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

  const stageIdx = stages.indexOf(contact.stage);
  const stageMeta = stageColor(stageIdx >= 0 ? stageIdx : 0);

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
            {stages.map((s, i) => {
              const m = stageColor(i);
              const isActive = contact.stage === s;
              const isPast = stages.indexOf(contact.stage) > i;
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

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex flex-1 flex-col overflow-hidden" dir="rtl">
          <TabsList className="mx-5 mt-3 mb-0 shrink-0 grid grid-cols-4 h-9">
            <TabsTrigger value="details" className="text-xs cursor-pointer">פרטים</TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs cursor-pointer">מדדים</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs cursor-pointer">הערות</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs cursor-pointer">פעילות</TabsTrigger>
          </TabsList>

          {/* ── Tab: פרטים ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto px-5 py-4 space-y-5 mt-2">

            {/* Contact info */}
            <section>
              <SectionTitle icon={<Phone className="h-3.5 w-3.5" />} title="פרטי קשר" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="שם מלא" value={val("name")} onChange={v => change("name", v)} onBlur={() => void blur("name")} />
                <LeadField label="טלפון" value={val("phone")} onChange={v => change("phone", v)} onBlur={() => void blur("phone")} dir="ltr" placeholder="050-0000000" />
                <LeadField label="מייל" value={val("email")} onChange={v => change("email", v)} onBlur={() => void blur("email")} dir="ltr" placeholder="mail@example.com" />
                <LeadField label="עיר" value={val("city")} onChange={v => change("city", v)} onBlur={() => void blur("city")} placeholder="תל אביב" />
                <div className="col-span-2">
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
                <LeadField label="סוג עסק" value={val("business_type")} onChange={v => change("business_type", v)} onBlur={() => void blur("business_type")} placeholder="בע״מ / עצמאי" />
                <LeadField label="תחום עיסוק" value={val("industry")} onChange={v => change("industry", v)} onBlur={() => void blur("industry")} placeholder="נדל״ן, מסחר…" />
                <LeadField label="סוג שירות" value={val("service_type")} onChange={v => change("service_type", v)} onBlur={() => void blur("service_type")} placeholder="ניהול מדיה…" />
                <LeadField label="מספר עובדים" value={val("employees_count")} onChange={v => change("employees_count", v)} onBlur={() => void blur("employees_count")} placeholder="10" />
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

            {/* Financial */}
            <section>
              <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5" />} title="כספי" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="הכנסה ראשונית" value={val("initial_revenue")} onChange={v => change("initial_revenue", v)} onBlur={() => void blur("initial_revenue")} placeholder="₪5,000" />
                <LeadField label="דמי ניהול חודשיים" value={val("monthly_fee")} onChange={v => change("monthly_fee", v)} onBlur={() => void blur("monthly_fee")} placeholder="₪3,000" />
                <LeadField label="תקציב פרסום חודשי" value={val("monthly_ad_budget")} onChange={v => change("monthly_ad_budget", v)} onBlur={() => void blur("monthly_ad_budget")} placeholder="₪3,000" />
                <LeadField label="ת.ז. / ח.פ." value={val("id_number")} onChange={v => change("id_number", v)} onBlur={() => void blur("id_number")} dir="ltr" placeholder="000000000" />
              </div>
            </section>

            {/* Website */}
            <section>
              <SectionTitle icon={<Globe className="h-3.5 w-3.5" />} title="אתר אינטרנט" />
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
            </section>

            {/* Dates */}
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground/70 shrink-0">
                  <CalendarDays className="h-3 w-3" /> תאריך יצירת ליד
                </label>
                <input
                  type="date"
                  value={f.lead_date !== undefined ? (f.lead_date ?? "") : (contact.lead_date ?? todayStr())}
                  onChange={e => setF(prev => ({ ...prev, lead_date: e.target.value }))}
                  onBlur={() => void blur("lead_date" as keyof Contact)}
                  className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground/70 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> עדכון אחרון
                </span>
                <span className="text-foreground">
                  {new Date(contact.updated_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              {(() => {
                const ref = contact.lead_date ?? contact.created_at;
                const ageDays = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
                return (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground/70">גיל ליד</span>
                    <span className="text-foreground">
                      {ageDays === 0 ? "היום" : ageDays === 1 ? "יום אחד" : `${ageDays} ימים`}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* All extra Fireberry fields */}
            {(() => {
              const extras = Object.entries(rawFields).filter(([k, v]) =>
                !FORM_FIELDS_SHOWN.has(k) &&
                v !== null && v !== undefined && v !== "" && v !== 0 && v !== false
              );
              if (extras.length === 0) return null;
              return (
                <section>
                  <SectionTitle icon={<ArrowRightLeft className="h-3.5 w-3.5" />} title="שדות נוספים מפיירברי" />
                  <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border/40">
                    {extras.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 px-3 py-1.5">
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {FB_FIELD_LABELS[k] ?? k}
                        </span>
                        <span className="text-[11px] font-medium text-right break-all max-w-[60%]">
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

          </TabsContent>

          {/* ── Tab: מדדים ── */}
          <TabsContent value="metrics" className="flex-1 overflow-y-auto px-5 py-4 space-y-5 mt-2">

            <section>
              <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5" />} title="מחזור" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="מחזור" value={val("turnover")} onChange={v => change("turnover", v)} onBlur={() => void blur("turnover")} placeholder="50000" dir="ltr" />
                <LeadField label="יעד מחזור" value={val("turnover_target")} onChange={v => change("turnover_target", v)} onBlur={() => void blur("turnover_target")} placeholder="150000" dir="ltr" />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">מרחק מהיעד</label>
                  <div className="flex h-9 items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 text-sm text-foreground/70">
                    <span>{contact.turnover_gap != null ? Number(contact.turnover_gap).toLocaleString("he-IL") : "—"}</span>
                    <span className="text-[9px] text-muted-foreground/50 rounded bg-muted px-1.5 py-0.5">מחושב</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={<ArrowRightLeft className="h-3.5 w-3.5" />} title="תזרים" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="תזרים" value={val("cashflow")} onChange={v => change("cashflow", v)} onBlur={() => void blur("cashflow")} placeholder="38000" dir="ltr" />
                <LeadField label="יעד תזרים" value={val("cashflow_target")} onChange={v => change("cashflow_target", v)} onBlur={() => void blur("cashflow_target")} placeholder="85000" dir="ltr" />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">מרחק מיעד תזרים</label>
                  <div className="flex h-9 items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 text-sm text-foreground/70">
                    <span>{contact.cashflow_gap != null ? Number(contact.cashflow_gap).toLocaleString("he-IL") : "—"}</span>
                    <span className="text-[9px] text-muted-foreground/50 rounded bg-muted px-1.5 py-0.5">מחושב</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={<Building2 className="h-3.5 w-3.5" />} title="פעילות עסקית" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="הוצאות תפעול" value={val("operating_expenses")} onChange={v => change("operating_expenses", v)} onBlur={() => void blur("operating_expenses")} placeholder="12000" dir="ltr" />
                <LeadField label="רווח תפעולי" value={val("operating_profit")} onChange={v => change("operating_profit", v)} onBlur={() => void blur("operating_profit")} placeholder="20000" dir="ltr" />
                <LeadField label="עסקה ממוצעת" value={val("avg_deal")} onChange={v => change("avg_deal", v)} onBlur={() => void blur("avg_deal")} placeholder="3500" dir="ltr" />
                <LeadField label="לידים" value={val("leads_fb")} onChange={v => change("leads_fb", v)} onBlur={() => void blur("leads_fb")} placeholder="10" dir="ltr" />
              </div>
            </section>

            <section>
              <SectionTitle icon={<Zap className="h-3.5 w-3.5" />} title="המרה ויחסי פעילות" />
              <div className="grid grid-cols-2 gap-3">
                <LeadField label="קיבולת %" value={val("capacity_pct")} onChange={v => change("capacity_pct", v)} onBlur={() => void blur("capacity_pct")} placeholder="60" dir="ltr" />
                <LeadField label="אחוז המרה" value={val("conversion_rate")} onChange={v => change("conversion_rate", v)} onBlur={() => void blur("conversion_rate")} placeholder="49" dir="ltr" />
                <LeadField label="המרה למקור %" value={val("source_conversion_rate")} onChange={v => change("source_conversion_rate", v)} onBlur={() => void blur("source_conversion_rate")} placeholder="30" dir="ltr" />
                <LeadField label="אופן התאגדות" value={val("incorporation_type")} onChange={v => change("incorporation_type", v)} onBlur={() => void blur("incorporation_type")} placeholder="בע״מ / עמותה…" />
              </div>
            </section>

          </TabsContent>

          {/* ── Tab: הערות ── */}
          <TabsContent value="notes" className="flex-1 overflow-y-auto px-5 py-4 space-y-5 mt-2">

            <section>
              <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title="הערות קצרות" />
              <Textarea
                value={val("notes")}
                onChange={e => change("notes", e.target.value)}
                onBlur={() => void blur("notes")}
                placeholder="רשום כאן כל פרט רלוונטי מהשיחה…"
                className="min-h-[120px] bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
              />
            </section>

            <section>
              <SectionTitle icon={<Users className="h-3.5 w-3.5" />} title="הערות מורחבות" />
              <Textarea
                value={val("extended_notes")}
                onChange={e => change("extended_notes", e.target.value)}
                onBlur={() => void blur("extended_notes")}
                placeholder="הערות נוספות, רקע, פרטים חשובים…"
                className="min-h-[140px] bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
              />
            </section>

            {contact.lost_reason !== null && contact.lost_reason !== undefined && contact.lost_reason !== "" && (
              <section>
                <SectionTitle icon={<AlertCircle className="h-3.5 w-3.5" />} title="סיבת סגירה" />
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  {contact.lost_reason}
                </div>
              </section>
            )}

          </TabsContent>

          {/* ── Tab: פעילות ── */}
          <TabsContent value="activity" className="flex-1 overflow-y-auto px-5 py-4 space-y-4 mt-2">
            <QuickLog onAdd={onAddActivity} />
            <ActivityFeed activities={activities} loading={activitiesLoading} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

// ─── Stages dialog ────────────────────────────────────────────────────────────

function StagesDialog({ open, stages, settingsId, onClose, onSave }: {
  open: boolean;
  stages: string[];
  settingsId: number | null;
  onClose: () => void;
  onSave: (newStages: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDraft([...stages]); }, [open, stages]);

  function rename(i: number, v: string) { setDraft(d => d.map((s, j) => j === i ? v : s)); }
  function moveUp(i: number) { if (i === 0) return; setDraft(d => { const a = [...d]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; }); }
  function moveDown(i: number) { if (i === draft.length - 1) return; setDraft(d => { const a = [...d]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; }); }
  function remove(i: number) { if (draft.length <= 1) return; setDraft(d => d.filter((_, j) => j !== i)); }

  async function save() {
    const cleaned = draft.map(s => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setSaving(true);
    // Rename contacts whose stage name changed
    for (let i = 0; i < stages.length; i++) {
      const oldName = stages[i];
      const newName = cleaned[i];
      if (newName && oldName !== newName) {
        await supabase.from("contacts").update({ stage: newName, updated_at: new Date().toISOString() }).eq("stage", oldName);
      }
    }
    // Persist to app_settings
    if (settingsId !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("app_settings") as any).update({ lead_stages: cleaned }).eq("id", settingsId);
    }
    setSaving(false);
    onSave(cleaned);
    onClose();
    toast.success("שלבים עודכנו");
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת שלבי לידים</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {draft.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stageColor(i).color }} />
              <Input
                value={s}
                onChange={e => rename(i, e.target.value)}
                className="h-8 flex-1 text-sm"
              />
              <button onClick={() => moveUp(i)} disabled={i === 0}
                className="cursor-pointer h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => moveDown(i)} disabled={i === draft.length - 1}
                className="cursor-pointer h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(i)} disabled={draft.length <= 1}
                className="cursor-pointer h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="cursor-pointer gap-1.5 w-full mt-1"
          onClick={() => setDraft(d => [...d, "שלב חדש"])}>
          <Plus className="h-3.5 w-3.5" /> הוסף שלב
        </Button>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={onClose}>ביטול</Button>
          <Button className="cursor-pointer" onClick={save} disabled={saving}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="text-muted-foreground/70">{icon}</span>
      {title}
      <span className="flex-1 border-t border-border/60" />
    </div>
  );
}

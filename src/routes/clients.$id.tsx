import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Phone, Mail, Building2, CalendarDays, ChevronRight, Loader2,
  Pencil, Save, X, ExternalLink, CheckSquare, Square, Film, Target,
  Globe, MapPin, Users, Instagram, Facebook, DollarSign, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients/$id")({
  component: ClientProfile,
});

// ── Types ──────────────────────────────────────────────────────────────────

type ClientFull = {
  id: string; name: string; phone: string | null; email: string | null;
  business_name: string | null; source: string; stage: string;
  assigned_to: string | null; plan_id: string | null; notes: string | null;
  created_at: string; updated_at: string;
  initial_revenue: string | null; industry: string | null;
  business_goals: string | null; client_status: string | null;
  client_since: string | null;
  // new fields
  service_type: string | null;
  id_number: string | null;
  website: string | null;
  employees_count: number | null;
  contract_signed_date: string | null;
  contract_end_date: string | null;
  monthly_fee: string | null;
  monthly_ad_budget: string | null;
  business_type: string | null;
  tax_id: string | null;
  city: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  tiktok_handle: string | null;
};

type ActionItem = { id: string; text: string; done: boolean };

type MeetingRow = {
  id: string; title: string; meeting_date: string; meeting_time: string | null;
  type: string; status: string; attendees: string[];
  notes: string | null; action_items: ActionItem[];
  duration_minutes: number | null;
};

type PlanInfo = { id: string; name: string; slug: string; accent_color: string | null };

type ContentItem = {
  id: string; title: string; content_type: string; status: string;
  due_date: string | null; assigned_editor: string | null;
};

type TaskRow = {
  id: string; title: string; status: string; priority: string; deadline: string | null;
};

type InternalTask = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
};

type Tab = "overview" | "meetings" | "plans" | "content" | "tasks";

// ── Constants ──────────────────────────────────────────────────────────────

const CLIENT_STATUS = {
  active: { label: "פעיל",   cls: "badge-success" },
  paused: { label: "מושהה",  cls: "badge-warning" },
  ended:  { label: "הסתיים", cls: "badge-urgent"  },
} as const;

const MTG_TYPE: Record<string, string> = {
  "ייעוץ": "ייעוץ", "שיווק": "שיווק", "צילום": "צילום",
  "מכירה ראשונית": "מכירה", "אסטרטגיה": "אסטרטגיה",
  "תוכן": "תוכן", "שבועית": "שבועית",
};

const AVATAR_COLORS = [
  "oklch(0.60 0.20 250)", "oklch(0.62 0.17 149)", "oklch(0.54 0.20 285)",
  "oklch(0.68 0.17 78)",  "oklch(0.60 0.22 25)",  "oklch(0.56 0.19 192)",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(d: string) {
  const date = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date.toDateString() === today.toDateString()) return "היום";
  if (date.toDateString() === new Date(today.getTime() + 86400000).toDateString()) return "מחר";
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// ── Main component ─────────────────────────────────────────────────────────

function ClientProfile() {
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const [client, setClient] = useState<ClientFull | null>(null);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [planTasks, setPlanTasks] = useState<TaskRow[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [internalTasks, setInternalTasks] = useState<InternalTask[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClientFull>>({});
  const [saving, setSaving] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [meetingNotes, setMeetingNotes] = useState<Record<string, string>>({});

  useEffect(() => { void load(); }, [id]);

  async function load() {
    setLoading(true);

    const { data: clientData, error: clientError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (clientError || !clientData) {
      setLoading(false);
      return;
    }

    const c = clientData as unknown as ClientFull;
    setClient(c);
    setEditForm(c);

    const [mtgsRes, contentRes] = await Promise.all([
      supabase
        .from("meetings")
        .select("*")
        .eq("contact_id", id)
        .order("meeting_date", { ascending: false }),
      supabase
        .from("content_items")
        .select("id,title,content_type,status,due_date,assigned_editor")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (mtgsRes.data) {
      const mapped: MeetingRow[] = mtgsRes.data.map((m) => ({
        ...m,
        action_items: Array.isArray(m.action_items)
          ? (m.action_items as unknown as ActionItem[])
          : [],
      }));
      setMeetings(mapped);
      const notesMap: Record<string, string> = {};
      for (const m of mapped) notesMap[m.id] = m.notes ?? "";
      setMeetingNotes(notesMap);
    }

    if (contentRes.data) setContent(contentRes.data as unknown as ContentItem[]);

    if (c.plan_id) {
      const { data: planData } = await supabase
        .from("plans")
        .select("id,name,slug,accent_color")
        .eq("id", c.plan_id)
        .single();

      if (planData) {
        const p = planData as unknown as PlanInfo;
        setPlan(p);

        const [tasksRes, internalRes] = await Promise.all([
          supabase
            .from("tasks")
            .select("id,title,status,priority,deadline")
            .eq("plan_id", p.id)
            .order("position"),
          supabase
            .from("internal_tasks")
            .select("id,title,status,priority,due_date")
            .eq("plan_id", c.plan_id),
        ]);
        if (tasksRes.data) setPlanTasks(tasksRes.data as unknown as TaskRow[]);
        if (internalRes.data) setInternalTasks(internalRes.data as unknown as InternalTask[]);
      }
    }

    setLoading(false);
  }

  async function saveClient() {
    if (!client) return;
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        name: editForm.name,
        business_name: editForm.business_name,
        phone: editForm.phone,
        email: editForm.email,
        city: editForm.city,
        website: editForm.website,
        industry: editForm.industry,
        business_type: editForm.business_type,
        service_type: editForm.service_type,
        id_number: editForm.id_number,
        tax_id: editForm.tax_id,
        employees_count: editForm.employees_count,
        contract_signed_date: editForm.contract_signed_date || null,
        contract_end_date: editForm.contract_end_date || null,
        monthly_fee: editForm.monthly_fee,
        monthly_ad_budget: editForm.monthly_ad_budget,
        initial_revenue: editForm.initial_revenue,
        business_goals: editForm.business_goals,
        instagram_handle: editForm.instagram_handle,
        facebook_url: editForm.facebook_url,
        tiktok_handle: editForm.tiktok_handle,
        notes: editForm.notes,
        client_status: editForm.client_status,
      } as never)
      .eq("id", client.id);
    setSaving(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    setClient((prev) => prev ? { ...prev, ...editForm } : prev);
    setEditing(false);
    toast.success("פרטים עודכנו");
  }

  async function saveMeetingNotes(meetingId: string) {
    const notes = meetingNotes[meetingId] ?? "";
    await supabase.from("meetings").update({ notes } as never).eq("id", meetingId);
    setMeetings((prev) => prev.map((m) => m.id === meetingId ? { ...m, notes } : m));
  }

  async function toggleActionItem(meetingId: string, itemId: string) {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    const updated = meeting.action_items.map((a) =>
      a.id === itemId ? { ...a, done: !a.done } : a
    );
    await supabase.from("meetings").update({ action_items: updated as never } as never).eq("id", meetingId);
    setMeetings((prev) =>
      prev.map((m) => m.id === meetingId ? { ...m, action_items: updated } : m)
    );
  }

  // ── Loading / not found ─────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">לקוח לא נמצא</p>
          <Button onClick={() => navigate({ to: "/clients" })}>חזרה ללקוחות</Button>
        </div>
      </AppShell>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────

  const col = avatarColor(client.name);
  const st = (client.client_status ?? "active") as keyof typeof CLIENT_STATUS;
  const today = new Date().toISOString().split("T")[0];
  const upcomingMeetings = meetings.filter(
    (m) => m.status === "מתוכנן" && m.meeting_date >= today
  ).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const pastMeetings = meetings.filter(
    (m) => m.status !== "מתוכנן" || m.meeting_date < today
  );
  const nextMtg = upcomingMeetings[0];
  const doneTasks = planTasks.filter((t) => t.status === "הושלם").length;
  const openInternalTasks = internalTasks.filter((t) => t.status !== "הושלם").length;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview",  label: "סקירה" },
    { key: "meetings",  label: "פגישות",  count: meetings.length },
    { key: "plans",     label: "תוכנית",  count: planTasks.length },
    { key: "content",   label: "תוכן",    count: content.length },
    { key: "tasks",     label: "משימות",  count: internalTasks.length },
  ];

  // ── Edit form field helper ──────────────────────────────────────────────

  function F(label: string, key: keyof ClientFull, opts?: { dir?: string; type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
        <Input
          type={opts?.type ?? "text"}
          dir={opts?.dir}
          placeholder={opts?.placeholder}
          value={(editForm[key] as string | number | null | undefined) ?? ""}
          onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value || null }))}
        />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />
      <div className="min-h-screen px-7 py-6" style={{ direction: "rtl" }}>

        {/* Back button */}
        <button
          onClick={() => navigate({ to: "/clients" })}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
          חזרה ללקוחות
        </button>

        {/* Header card */}
        <div className="glass mb-6 rounded-2xl p-6">
          <div className="flex items-start gap-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
              style={{ backgroundColor: col }}
            >
              {initials(client.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
                  {client.business_name && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{client.business_name}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", CLIENT_STATUS[st]?.cls ?? "badge-primary")}>
                      {CLIENT_STATUS[st]?.label}
                    </span>
                    {client.service_type && (
                      <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {client.service_type}
                      </span>
                    )}
                    {client.industry && (
                      <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {client.industry}
                      </span>
                    )}
                    {client.city && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {client.city}
                      </span>
                    )}
                    {client.client_since && (
                      <span className="text-xs text-muted-foreground">
                        לקוח מ-{fmtDate(client.client_since)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditing(true); setTab("overview"); }}
                >
                  <Pencil className="me-1 h-3.5 w-3.5" />
                  עריכה
                </Button>
              </div>

              {/* Contact links */}
              <div className="mt-3 flex flex-wrap gap-3">
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span dir="ltr">{client.phone}</span>
                  </a>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{client.email}</span>
                  </a>
                )}
                {client.website && (
                  <a
                    href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span dir="ltr">{client.website}</span>
                  </a>
                )}
              </div>

              {/* Next meeting */}
              {nextMtg && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">פגישה הבאה:</span>
                  <span className="font-medium text-primary">{fmtShort(nextMtg.meeting_date)}</span>
                  <span className="text-muted-foreground">— {nextMtg.title}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  tab === key ? "bg-white/20" : "bg-muted"
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview tab ───────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Details card — left 2 cols */}
            <div className="glass rounded-2xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">פרטי לקוח</h2>
                {editing ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveClient()} disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      שמירה
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(client); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {editing ? (
                <div className="space-y-5">
                  {/* פרטי קשר */}
                  <div>
                    <SectionTitle>פרטי קשר</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {F("שם מלא", "name")}
                      {F("שם עסק", "business_name")}
                      {F("טלפון", "phone", { dir: "ltr" })}
                      {F("מייל", "email", { dir: "ltr" })}
                      {F("עיר", "city")}
                      {F("אתר אינטרנט", "website", { dir: "ltr", placeholder: "https://..." })}
                    </div>
                  </div>

                  {/* פרטים עסקיים */}
                  <div className="border-t border-border/50 pt-4">
                    <SectionTitle>פרטים עסקיים</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {F("ענף עסקי", "industry")}
                      {F("סוג עסק", "business_type", { placeholder: "עוסק מורשה / חברה בע\"מ..." })}
                      {F("ח.פ / ע.מ", "tax_id", { dir: "ltr" })}
                      {F("ת.ז", "id_number", { dir: "ltr" })}
                      {F("מספר עובדים", "employees_count", { type: "number" })}
                      {F("מחזור התחלתי", "initial_revenue", { placeholder: "₪..." })}
                    </div>
                  </div>

                  {/* שירות וחוזה */}
                  <div className="border-t border-border/50 pt-4">
                    <SectionTitle>שירות וחוזה</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {F("סוג שירות", "service_type", { placeholder: "ניהול שיווק / ייעוץ..." })}
                      {F("עלות חודשית", "monthly_fee", { placeholder: "₪..." })}
                      {F("תקציב פרסום חודשי", "monthly_ad_budget", { placeholder: "₪..." })}
                      <div />
                      {F("תאריך חתימת חוזה", "contract_signed_date", { type: "date" })}
                      {F("תאריך סיום חוזה", "contract_end_date", { type: "date" })}
                    </div>
                  </div>

                  {/* רשתות חברתיות */}
                  <div className="border-t border-border/50 pt-4">
                    <SectionTitle>רשתות חברתיות</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {F("אינסטגרם", "instagram_handle", { dir: "ltr", placeholder: "@handle" })}
                      {F("פייסבוק", "facebook_url", { dir: "ltr", placeholder: "https://facebook.com/..." })}
                      {F("טיקטוק", "tiktok_handle", { dir: "ltr", placeholder: "@handle" })}
                    </div>
                  </div>

                  {/* סטטוס + מטרות */}
                  <div className="border-t border-border/50 pt-4">
                    <SectionTitle>נוסף</SectionTitle>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">סטטוס</label>
                        <select
                          value={editForm.client_status ?? "active"}
                          onChange={(e) => setEditForm((f) => ({ ...f, client_status: e.target.value }))}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="active">פעיל</option>
                          <option value="paused">מושהה</option>
                          <option value="ended">הסתיים</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">מטרות עסקיות</label>
                        <Textarea value={editForm.business_goals ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, business_goals: e.target.value }))} rows={3} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">הערות</label>
                        <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* פרטי קשר */}
                  <div>
                    <SectionTitle>פרטי קשר</SectionTitle>
                    <div className="space-y-2">
                      <InfoRow label="שם" value={client.name} />
                      <InfoRow label="עסק" value={client.business_name} />
                      <InfoRow label="טלפון" value={client.phone} dir="ltr" />
                      <InfoRow label="מייל" value={client.email} />
                      <InfoRow label="עיר" value={client.city} />
                      <InfoRow label="אתר" value={client.website} dir="ltr" link />
                      <InfoRow label="מקור" value={client.source} />
                    </div>
                  </div>

                  {/* פרטים עסקיים */}
                  <div className="border-t border-border/50 pt-5">
                    <SectionTitle>פרטים עסקיים</SectionTitle>
                    <div className="space-y-2">
                      <InfoRow label="ענף" value={client.industry} />
                      <InfoRow label="סוג עסק" value={client.business_type} />
                      <InfoRow label="ח.פ / ע.מ" value={client.tax_id} dir="ltr" />
                      <InfoRow label="ת.ז" value={client.id_number} dir="ltr" />
                      <InfoRow label="עובדים" value={client.employees_count != null ? String(client.employees_count) : null} />
                      <InfoRow label="מחזור התחלתי" value={client.initial_revenue} />
                    </div>
                  </div>

                  {/* שירות וחוזה */}
                  <div className="border-t border-border/50 pt-5">
                    <SectionTitle>שירות וחוזה</SectionTitle>
                    <div className="space-y-2">
                      <InfoRow label="סוג שירות" value={client.service_type} />
                      <InfoRow label="עלות חודשית" value={client.monthly_fee} />
                      <InfoRow label="תקציב פרסום" value={client.monthly_ad_budget} />
                      <InfoRow label="חתימת חוזה" value={client.contract_signed_date ? fmtDate(client.contract_signed_date) : null} />
                      <InfoRow label="סיום חוזה" value={client.contract_end_date ? fmtDate(client.contract_end_date) : null} />
                    </div>
                  </div>

                  {/* רשתות חברתיות */}
                  {(client.instagram_handle || client.facebook_url || client.tiktok_handle) && (
                    <div className="border-t border-border/50 pt-5">
                      <SectionTitle>רשתות חברתיות</SectionTitle>
                      <div className="space-y-2">
                        {client.instagram_handle && (
                          <div className="flex items-center gap-2">
                            <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-foreground" dir="ltr">{client.instagram_handle}</span>
                          </div>
                        )}
                        {client.facebook_url && (
                          <div className="flex items-center gap-2">
                            <Facebook className="h-3.5 w-3.5 text-muted-foreground" />
                            <a
                              href={client.facebook_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary hover:underline"
                              dir="ltr"
                            >
                              {client.facebook_url}
                            </a>
                          </div>
                        )}
                        {client.tiktok_handle && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">TikTok</span>
                            <span className="text-sm text-foreground" dir="ltr">{client.tiktok_handle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* מטרות + הערות */}
                  {client.business_goals && (
                    <div className="border-t border-border/50 pt-5">
                      <SectionTitle>מטרות עסקיות</SectionTitle>
                      <p className="text-sm text-foreground">{client.business_goals}</p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="border-t border-border/50 pt-5">
                      <SectionTitle>הערות</SectionTitle>
                      <p className="text-sm text-foreground">{client.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right col — quick stats + recent meetings */}
            <div className="space-y-4">
              <div className="glass rounded-2xl p-5">
                <h2 className="mb-4 text-base font-semibold text-foreground">סטטיסטיקות</h2>
                <div className="space-y-3">
                  <StatRow icon={<CalendarDays className="h-4 w-4 text-primary" />} label="פגישות" value={String(meetings.length)} />
                  <StatRow icon={<Film className="h-4 w-4 text-purple-400" />} label="פריטי תוכן" value={String(content.length)} />
                  <StatRow icon={<Target className="h-4 w-4 text-amber-400" />} label="משימות פתוחות" value={String(openInternalTasks)} />
                  {client.monthly_fee && (
                    <StatRow icon={<DollarSign className="h-4 w-4 text-green-400" />} label="עלות חודשית" value={client.monthly_fee} />
                  )}
                  {client.employees_count != null && (
                    <StatRow icon={<Users className="h-4 w-4 text-sky-400" />} label="עובדים" value={String(client.employees_count)} />
                  )}
                  {plan && (
                    <StatRow
                      icon={<FileText className="h-4 w-4 text-teal-400" />}
                      label="תוכנית"
                      value={plan.name}
                    />
                  )}
                </div>
              </div>

              {meetings.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h2 className="mb-4 text-base font-semibold text-foreground">פגישות אחרונות</h2>
                  <div className="space-y-3">
                    {meetings.slice(0, 4).map((m) => (
                      <div key={m.id} className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{fmtShort(m.meeting_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract info card */}
              {(client.contract_signed_date || client.contract_end_date) && (
                <div className="glass rounded-2xl p-5">
                  <h2 className="mb-3 text-base font-semibold text-foreground">חוזה</h2>
                  <div className="space-y-2">
                    {client.contract_signed_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">חתימה:</span>
                        <span className="text-foreground">{fmtDate(client.contract_signed_date)}</span>
                      </div>
                    )}
                    {client.contract_end_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">סיום:</span>
                        <span className="text-foreground">{fmtDate(client.contract_end_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Meetings tab ───────────────────────────────────────────── */}
        {tab === "meetings" && (
          <div className="space-y-6">
            {meetings.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-10 w-10" />} text="אין פגישות" />
            ) : (
              <>
                {upcomingMeetings.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">פגישות קרובות</h2>
                    <div className="space-y-3">
                      {upcomingMeetings.map((m) => (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          expanded={expandedMeeting === m.id}
                          onToggle={() => setExpandedMeeting((p) => p === m.id ? null : m.id)}
                          notes={meetingNotes[m.id] ?? ""}
                          onNotesChange={(v) => setMeetingNotes((p) => ({ ...p, [m.id]: v }))}
                          onNotesSave={() => void saveMeetingNotes(m.id)}
                          onToggleAction={(itemId) => void toggleActionItem(m.id, itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {pastMeetings.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">פגישות קודמות</h2>
                    <div className="space-y-3">
                      {pastMeetings.map((m) => (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          expanded={expandedMeeting === m.id}
                          onToggle={() => setExpandedMeeting((p) => p === m.id ? null : m.id)}
                          notes={meetingNotes[m.id] ?? ""}
                          onNotesChange={(v) => setMeetingNotes((p) => ({ ...p, [m.id]: v }))}
                          onNotesSave={() => void saveMeetingNotes(m.id)}
                          onToggleAction={(itemId) => void toggleActionItem(m.id, itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Plans tab ──────────────────────────────────────────────── */}
        {tab === "plans" && (
          <div>
            {!plan ? (
              <EmptyState icon={<Target className="h-10 w-10" />} text="לא משויכת תוכנית" />
            ) : (
              <div className="glass rounded-2xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: plan.accent_color ?? col }}
                    />
                    <h2 className="text-base font-semibold text-foreground">{plan.name}</h2>
                  </div>
                  <a
                    href={`/p/${plan.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    פורטל לקוח
                  </a>
                </div>

                {planTasks.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>התקדמות</span>
                      <span>{doneTasks}/{planTasks.length}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round((doneTasks / planTasks.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {planTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין משימות בתוכנית</p>
                ) : (
                  <div className="space-y-2">
                    {planTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30">
                        {t.status === "הושלם" ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className={cn("flex-1 text-sm", t.status === "הושלם" && "line-through text-muted-foreground")}>
                          {t.title}
                        </span>
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          t.priority === "גבוהה" ? "badge-urgent" : t.priority === "בינונית" ? "badge-warning" : "badge-primary"
                        )}>
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Content tab ────────────────────────────────────────────── */}
        {tab === "content" && (
          <div>
            {content.length === 0 ? (
              <EmptyState icon={<Film className="h-10 w-10" />} text="אין פריטי תוכן" />
            ) : (
              <div className="space-y-2">
                {content.map((item) => (
                  <div key={item.id} className="glass flex items-center gap-3 rounded-xl p-4">
                    <Film className="h-4 w-4 shrink-0 text-purple-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      {item.assigned_editor && (
                        <p className="text-xs text-muted-foreground">עורך: {item.assigned_editor}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="badge-primary rounded px-2 py-0.5 text-[10px]">{item.content_type}</span>
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-medium",
                        item.status === "הושלם" ? "badge-success" : item.status === "בעריכה" ? "badge-warning" : "badge-primary"
                      )}>
                        {item.status}
                      </span>
                      {item.due_date && (
                        <span className="text-xs text-muted-foreground">{fmtShort(item.due_date)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tasks tab ──────────────────────────────────────────────── */}
        {tab === "tasks" && (
          <div>
            {internalTasks.length === 0 ? (
              <EmptyState icon={<Target className="h-10 w-10" />} text="אין משימות פנימיות" />
            ) : (
              <div className="space-y-2">
                {internalTasks.map((t) => {
                  const overdue = t.due_date && t.due_date < today && t.status !== "הושלם";
                  return (
                    <div key={t.id} className="glass flex items-center gap-3 rounded-xl p-4">
                      {t.status === "הושלם" ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", t.status === "הושלם" && "line-through text-muted-foreground")}>
                          {t.title}
                        </p>
                        {t.due_date && (
                          <p className={cn("text-xs", overdue ? "text-red-400" : "text-muted-foreground")}>
                            {overdue ? "באיחור — " : ""}{fmtShort(t.due_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          t.priority === "גבוהה" ? "badge-urgent" : t.priority === "בינונית" ? "badge-warning" : "badge-primary"
                        )}>
                          {t.priority}
                        </span>
                        <span className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">{t.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function InfoRow({
  label, value, dir, link,
}: {
  label: string; value: string | null | undefined; dir?: string; link?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-[90px] shrink-0 text-xs text-muted-foreground">{label}</span>
      {link ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
          dir={dir}
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-foreground" dir={dir}>{value}</span>
      )}
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
      {icon}
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function MeetingCard({
  meeting, expanded, onToggle,
  notes, onNotesChange, onNotesSave, onToggleAction,
}: {
  meeting: MeetingRow;
  expanded: boolean;
  onToggle: () => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onNotesSave: () => void;
  onToggleAction: (itemId: string) => void;
}) {
  const typeLabel = MTG_TYPE[meeting.type] ?? meeting.type;
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-muted/20"
      >
        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{meeting.title}</span>
            <span className="badge-primary rounded px-1.5 py-0.5 text-[10px]">{typeLabel}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{fmtDate(meeting.meeting_date)}</span>
            {meeting.meeting_time && <span>{meeting.meeting_time}</span>}
            {meeting.attendees.length > 0 && (
              <span>· {meeting.attendees.join(", ")}</span>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "-rotate-90")}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">סיכום פגישה</label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesSave}
              rows={3}
              placeholder="הוסף סיכום..."
            />
          </div>

          {meeting.action_items.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">משימות לביצוע</label>
              <div className="space-y-1.5">
                {meeting.action_items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onToggleAction(a.id)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-right transition-colors hover:bg-muted/30"
                  >
                    {a.done ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn("text-sm", a.done && "line-through text-muted-foreground")}>
                      {a.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

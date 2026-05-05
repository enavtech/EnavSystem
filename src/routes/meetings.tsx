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
  Plus, CalendarDays, Clock, MapPin, Users, Loader2,
  CheckCircle2, Circle, XCircle, Pencil, Trash2, ChevronDown,
  FileText, Building2, ChevronLeft,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/meetings")({
  component: MeetingsPage,
  head: () => ({ meta: [{ title: "פגישות" }] }),
});

// ── Types ──────────────────────────────────────────────────────────────────

type ActionItem = { text: string; done: boolean };

type Meeting = {
  id: string;
  contact_id: string | null;
  plan_id: string | null;
  type: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  duration_minutes: number | null;
  status: string;
  attendees: string[];
  location: string | null;
  notes: string | null;
  action_items: ActionItem[];
  created_at: string;
};

type Contact = { id: string; name: string; business_name: string | null };

// ── Constants ──────────────────────────────────────────────────────────────

const MEETING_TYPES = ["ייעוץ", "שיווק", "צילום", "מכירה ראשונית", "אסטרטגיה", "תוכן", "שבועית"];
const MEETING_STATUSES = ["מתוכנן", "הושלם", "בוטל"];
const TEAM_MEMBERS = ["ענב", "אוריאל", "דניאל"];

const TYPE_COLORS: Record<string, string> = {
  "ייעוץ":          "bg-blue-100 text-blue-700",
  "שיווק":          "bg-violet-100 text-violet-700",
  "צילום":          "bg-amber-100 text-amber-700",
  "מכירה ראשונית": "bg-green-100 text-green-700",
  "אסטרטגיה":      "bg-indigo-100 text-indigo-700",
  "תוכן":           "bg-pink-100 text-pink-700",
  "שבועית":         "bg-slate-100 text-slate-600",
};

const STATUS_CFG: Record<string, { icon: React.ReactNode; cls: string }> = {
  "מתוכנן": { icon: <Circle className="h-3.5 w-3.5" />,      cls: "text-muted-foreground" },
  "הושלם":  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "text-emerald-500" },
  "בוטל":   { icon: <XCircle className="h-3.5 w-3.5" />,      cls: "text-red-400" },
};

const EMPTY_FORM = {
  title: "", type: "ייעוץ", meeting_date: "", meeting_time: "",
  duration_minutes: "60", status: "מתוכנן", contact_id: "",
  attendees: [] as string[], location: "", notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDateLong(d: string) {
  return new Date(d).toLocaleDateString("he-IL", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}
function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { weekday: "short" });
}

// ── Main component ─────────────────────────────────────────────────────────

function MeetingsPage() {
  const navigate = useNavigate();

  // Data
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("הכל");
  const [filterStatus, setFilterStatus] = useState("הכל");

  // Selected meeting
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Summary (notes) local editing state
  const [summaryText, setSummaryText] = useState("");
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Action item input
  const [newAction, setNewAction] = useState("");

  // Create / Edit dialog
  const [showAdd, setShowAdd] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const [{ data: mtgs }, { data: cts }] = await Promise.all([
      supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
      supabase.from("contacts").select("id,name,business_name").order("name"),
    ]);
    setMeetings((mtgs ?? []) as unknown as Meeting[]);
    setContacts((cts ?? []) as Contact[]);
    setLoading(false);
  }

  // ── Derived data ──────────────────────────────────────────────────────

  const filtered = useMemo(() => meetings.filter((m) => {
    if (filterType !== "הכל" && m.type !== filterType) return false;
    if (filterStatus !== "הכל" && m.status !== filterStatus) return false;
    return true;
  }), [meetings, filterType, filterStatus]);

  const grouped = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = filtered.filter((m) => m.meeting_date >= today)
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    const past = filtered.filter((m) => m.meeting_date < today);
    return { upcoming, past };
  }, [filtered]);

  const contactMap = useMemo(() => {
    const m: Record<string, Contact> = {};
    contacts.forEach((c) => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedId) ?? null,
    [meetings, selectedId]
  );

  // Sync summary text when selection changes
  useEffect(() => {
    setSummaryText(selectedMeeting?.notes ?? "");
    setSummaryDirty(false);
    setNewAction("");
  }, [selectedId]);

  // ── Summary auto-save ─────────────────────────────────────────────────

  async function saveSummary() {
    if (!selectedMeeting || !summaryDirty) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("meetings")
      .update({ notes: summaryText || null, updated_at: new Date().toISOString() } as never)
      .eq("id", selectedMeeting.id);
    setSavingNotes(false);
    if (!error) {
      setMeetings((prev) => prev.map((m) =>
        m.id === selectedMeeting.id ? { ...m, notes: summaryText || null } : m
      ));
      setSummaryDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  }

  // ── Action items ──────────────────────────────────────────────────────

  async function toggleAction(idx: number) {
    if (!selectedMeeting) return;
    const updated = selectedMeeting.action_items.map((a, i) =>
      i === idx ? { ...a, done: !a.done } : a
    );
    await supabase
      .from("meetings")
      .update({ action_items: updated as never, updated_at: new Date().toISOString() } as never)
      .eq("id", selectedMeeting.id);
    setMeetings((prev) => prev.map((m) =>
      m.id === selectedMeeting.id ? { ...m, action_items: updated } : m
    ));
  }

  async function deleteAction(idx: number) {
    if (!selectedMeeting) return;
    const updated = selectedMeeting.action_items.filter((_, i) => i !== idx);
    await supabase
      .from("meetings")
      .update({ action_items: updated as never, updated_at: new Date().toISOString() } as never)
      .eq("id", selectedMeeting.id);
    setMeetings((prev) => prev.map((m) =>
      m.id === selectedMeeting.id ? { ...m, action_items: updated } : m
    ));
  }

  async function addAction() {
    if (!selectedMeeting || !newAction.trim()) return;
    const updated = [...(selectedMeeting.action_items ?? []), { text: newAction.trim(), done: false }];
    await supabase
      .from("meetings")
      .update({ action_items: updated as never, updated_at: new Date().toISOString() } as never)
      .eq("id", selectedMeeting.id);
    setMeetings((prev) => prev.map((m) =>
      m.id === selectedMeeting.id ? { ...m, action_items: updated } : m
    ));
    setNewAction("");
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  async function saveMeeting() {
    if (!form.title.trim()) { toast.error("חובה כותרת"); return; }
    if (!form.meeting_date) { toast.error("חובה תאריך"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      type: form.type,
      meeting_date: form.meeting_date,
      meeting_time: form.meeting_time || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      status: form.status,
      contact_id: form.contact_id || null,
      attendees: form.attendees,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editMeeting) {
      const { error } = await supabase.from("meetings").update(payload as never).eq("id", editMeeting.id);
      if (error) toast.error(error.message); else toast.success("עודכן");
    } else {
      const { data, error } = await supabase.from("meetings").insert(payload as never).select().single();
      if (error) toast.error(error.message);
      else {
        toast.success("נוצרה פגישה");
        if (data) setSelectedId((data as unknown as Meeting).id);
      }
    }
    setSaving(false);
    setShowAdd(false);
    setEditMeeting(null);
    setForm({ ...EMPTY_FORM });
    void load();
  }

  async function deleteMeeting(id: string) {
    if (!confirm("למחוק פגישה?")) return;
    await supabase.from("meetings").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
    void load();
  }

  function openEdit(m: Meeting) {
    setForm({
      title: m.title, type: m.type, meeting_date: m.meeting_date,
      meeting_time: m.meeting_time ?? "", duration_minutes: String(m.duration_minutes ?? 60),
      status: m.status, contact_id: m.contact_id ?? "",
      attendees: m.attendees ?? [], location: m.location ?? "", notes: m.notes ?? "",
    });
    setEditMeeting(m);
    setShowAdd(true);
  }

  function toggleAttendee(member: string) {
    setForm((f) => ({
      ...f,
      attendees: f.attendees.includes(member)
        ? f.attendees.filter((a) => a !== member)
        : [...f.attendees, member],
    }));
  }

  // ── Loading ───────────────────────────────────────────────────────────

  if (loading) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  // ── Render ────────────────────────────────────────────────────────────

  const actionsDone = selectedMeeting
    ? selectedMeeting.action_items.filter((a) => a.done).length
    : 0;
  const actionsTotal = selectedMeeting?.action_items.length ?? 0;

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      <div className="flex flex-col" style={{ height: "100dvh" }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">פגישות</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{filtered.length} פגישות</p>
            </div>
            <Button
              size="sm"
              onClick={() => { setForm({ ...EMPTY_FORM }); setEditMeeting(null); setShowAdd(true); }}
            >
              <Plus className="me-1.5 h-3.5 w-3.5" />
              פגישה חדשה
            </Button>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 overflow-x-auto">
              {["הכל", ...MEETING_TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                    filterType === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="h-4 w-px shrink-0 bg-border" />
            <div className="flex items-center gap-1">
              {["הכל", ...MEETING_STATUSES].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                    filterStatus === s
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Split panels ────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">

          {/* Meeting list — right (first in RTL) */}
          <div className="w-[320px] shrink-0 overflow-y-auto border-l border-border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground/50">
                <CalendarDays className="mb-3 h-8 w-8" />
                <p className="text-sm">אין פגישות</p>
              </div>
            ) : (
              <div className="space-y-0">
                {grouped.upcoming.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/80 px-4 py-2 backdrop-blur-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">עתידיות</span>
                      <span className="ms-auto text-[10px] text-muted-foreground">{grouped.upcoming.length}</span>
                    </div>
                    {grouped.upcoming.map((m) => (
                      <ListItem
                        key={m.id}
                        meeting={m}
                        contact={m.contact_id ? contactMap[m.contact_id] : undefined}
                        selected={selectedId === m.id}
                        onClick={() => setSelectedId(m.id)}
                      />
                    ))}
                  </div>
                )}
                {grouped.past.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/80 px-4 py-2 backdrop-blur-sm">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">עברו</span>
                      <span className="ms-auto text-[10px] text-muted-foreground">{grouped.past.length}</span>
                    </div>
                    {grouped.past.map((m) => (
                      <ListItem
                        key={m.id}
                        meeting={m}
                        contact={m.contact_id ? contactMap[m.contact_id] : undefined}
                        selected={selectedId === m.id}
                        onClick={() => setSelectedId(m.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail panel — left */}
          <div className="flex-1 overflow-y-auto bg-background">
            {!selectedMeeting ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/40">
                <CalendarDays className="h-12 w-12" />
                <p className="text-sm text-muted-foreground">בחר פגישה מהרשימה לצפייה בסיכום</p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl px-8 py-6" style={{ direction: "rtl" }}>

                {/* Meeting header */}
                <div className="mb-6">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TYPE_COLORS[selectedMeeting.type] ?? "bg-muted")}>
                      {selectedMeeting.type}
                    </span>
                    <span className={cn("flex items-center gap-1 text-xs font-medium", STATUS_CFG[selectedMeeting.status]?.cls)}>
                      {STATUS_CFG[selectedMeeting.status]?.icon}
                      {selectedMeeting.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedMeeting.title}</h2>

                  {/* Metadata */}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDateLong(selectedMeeting.meeting_date)}
                    </span>
                    {selectedMeeting.meeting_time && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {selectedMeeting.meeting_time}
                        {selectedMeeting.duration_minutes ? ` · ${selectedMeeting.duration_minutes} דקות` : ""}
                      </span>
                    )}
                    {selectedMeeting.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedMeeting.location}
                      </span>
                    )}
                    {selectedMeeting.contact_id && contactMap[selectedMeeting.contact_id] && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {contactMap[selectedMeeting.contact_id]!.name}
                        {contactMap[selectedMeeting.contact_id]!.business_name
                          ? ` · ${contactMap[selectedMeeting.contact_id]!.business_name}`
                          : ""}
                      </span>
                    )}
                    {(selectedMeeting.attendees?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {selectedMeeting.attendees.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(selectedMeeting)}>
                      <Pencil className="me-1.5 h-3.5 w-3.5" />
                      עריכת פרטים
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void deleteMeeting(selectedMeeting.id)}
                    >
                      <Trash2 className="me-1.5 h-3.5 w-3.5" />
                      מחיקה
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">

                  {/* ── Summary / Notes ──────────────────────────────── */}
                  <div className="glass rounded-2xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">סיכום פגישה</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {savingNotes && (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            שומר...
                          </span>
                        )}
                        {savedFlash && !savingNotes && (
                          <span className="flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" />
                            נשמר
                          </span>
                        )}
                        {summaryDirty && !savingNotes && (
                          <button
                            onClick={() => void saveSummary()}
                            className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            שמור
                          </button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      value={summaryText}
                      onChange={(e) => { setSummaryText(e.target.value); setSummaryDirty(true); }}
                      onBlur={() => void saveSummary()}
                      placeholder="כתוב כאן את סיכום הפגישה — נושאים שעלו, החלטות, הסכמות..."
                      className="min-h-[160px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                      style={{ direction: "rtl" }}
                    />
                  </div>

                  {/* ── Action items ─────────────────────────────────── */}
                  <div className="glass rounded-2xl p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">משימות שיצאו מהפגישה</h3>
                      </div>
                      {actionsTotal > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {actionsDone}/{actionsTotal} הושלמו
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {actionsTotal > 0 && (
                      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.round((actionsDone / actionsTotal) * 100)}%` }}
                        />
                      </div>
                    )}

                    {/* Items list */}
                    <div className="space-y-1">
                      {(selectedMeeting.action_items ?? []).length === 0 ? (
                        <p className="py-2 text-xs text-muted-foreground/60">
                          אין משימות — הוסף למטה
                        </p>
                      ) : (
                        selectedMeeting.action_items.map((item, idx) => (
                          <ActionRow
                            key={idx}
                            item={item}
                            onToggle={() => void toggleAction(idx)}
                            onDelete={() => void deleteAction(idx)}
                          />
                        ))
                      )}
                    </div>

                    {/* Add new */}
                    <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                      <Input
                        value={newAction}
                        onChange={(e) => setNewAction(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void addAction(); }}
                        placeholder="הוסף משימה..."
                        className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => void addAction()}
                        disabled={!newAction.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Create / Edit dialog ────────────────────────────────────── */}
      <Dialog
        open={showAdd}
        onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditMeeting(null); } }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editMeeting ? "עריכת פגישה" : "פגישה חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">כותרת *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="נושא הפגישה" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">סוג</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEETING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">סטטוס</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEETING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">תאריך *</label>
                <Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שעה</label>
                <Input type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">משך (דקות)</label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} dir="ltr" min="15" step="15" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">מיקום</label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="זום / משרד / אצל הלקוח" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">לקוח</label>
              <Select value={form.contact_id || "_none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— ללא לקוח —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— ללא —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.business_name ? ` · ${c.business_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">משתתפים</label>
              <div className="flex gap-2">
                {TEAM_MEMBERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleAttendee(m)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      form.attendees.includes(m)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditMeeting(null); }}>ביטול</Button>
            <Button onClick={() => void saveMeeting()} disabled={saving}>
              {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {editMeeting ? "עדכן" : "צור פגישה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}

// ── List item ──────────────────────────────────────────────────────────────

function ListItem({
  meeting, contact, selected, onClick,
}: {
  meeting: Meeting;
  contact?: Contact;
  selected: boolean;
  onClick: () => void;
}) {
  const items = meeting.action_items ?? [];
  const done = items.filter((a) => a.done).length;
  const hasSummary = !!meeting.notes?.trim();
  const statusCfg = STATUS_CFG[meeting.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 border-b border-border/60 px-4 py-3.5 text-right transition-colors",
        selected
          ? "bg-primary/8 border-r-2 border-r-primary"
          : "hover:bg-muted/50"
      )}
    >
      {/* Date block */}
      <div className={cn(
        "flex w-11 shrink-0 flex-col items-center rounded-lg py-1.5 text-center",
        selected ? "bg-primary text-white" : "bg-muted"
      )}>
        <div className={cn("text-[9px] font-medium", selected ? "text-white/70" : "text-muted-foreground")}>
          {fmtDay(meeting.meeting_date)}
        </div>
        <div className={cn("text-lg font-bold leading-tight", selected ? "text-white" : "text-foreground")}>
          {new Date(meeting.meeting_date).getDate()}
        </div>
        <div className={cn("text-[9px]", selected ? "text-white/70" : "text-muted-foreground")}>
          {new Date(meeting.meeting_date).toLocaleDateString("he-IL", { month: "short" })}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-sm font-semibold text-foreground">{meeting.title}</span>
          <span className={cn("mt-0.5 shrink-0", statusCfg?.cls)}>
            {statusCfg?.icon}
          </span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", TYPE_COLORS[meeting.type] ?? "bg-muted")}>
            {meeting.type}
          </span>
          {contact && (
            <span className="truncate text-[11px] text-muted-foreground">{contact.name}</span>
          )}
          {meeting.meeting_time && (
            <span className="text-[11px] text-muted-foreground">{meeting.meeting_time}</span>
          )}
        </div>

        {/* Indicators */}
        <div className="mt-1.5 flex items-center gap-2">
          {hasSummary && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <FileText className="h-2.5 w-2.5" />
              סיכום
            </span>
          )}
          {items.length > 0 && (
            <span className={cn(
              "flex items-center gap-0.5 text-[10px]",
              done === items.length ? "text-emerald-500" : "text-muted-foreground"
            )}>
              <CheckCircle2 className="h-2.5 w-2.5" />
              {done}/{items.length}
            </span>
          )}
        </div>
      </div>

      <ChevronLeft className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50", selected && "text-primary")} />
    </button>
  );
}

// ── Action item row ────────────────────────────────────────────────────────

function ActionRow({
  item, onToggle, onDelete,
}: {
  item: ActionItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
      <button
        onClick={onToggle}
        className={cn(
          "mt-0.5 shrink-0 transition-colors",
          item.done ? "text-emerald-500" : "text-muted-foreground hover:text-primary"
        )}
      >
        {item.done
          ? <CheckCircle2 className="h-4 w-4" />
          : <Circle className="h-4 w-4" />
        }
      </button>
      <span className={cn(
        "flex-1 text-sm leading-snug",
        item.done ? "line-through text-muted-foreground" : "text-foreground"
      )}>
        {item.text}
      </span>
      <button
        onClick={onDelete}
        className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50 hover:!text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

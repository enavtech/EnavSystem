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
  Plus, Calendar, Loader2, X, Trash2,
  CheckCircle2, Clock, Circle, FileText,
  Video, ExternalLink, ChevronLeft, Camera,
  Pencil,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/content")({
  component: ContentPage,
  head: () => ({ meta: [{ title: "תוכן — פרודקשן" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type ShootVideo = {
  id: string;
  shoot_day_id: string;
  title: string;
  content_type: string;
  edit_status: string;
  assigned_editor: string | null;
  drive_link: string | null;
  notes: string | null;
  position: number;
  created_at: string;
};

type ShootDay = {
  id: string;
  contact_id: string | null;
  shoot_date: string | null;
  creative_brief: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  videos: ShootVideo[];
};

type Contact = { id: string; name: string; business_name: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const EDIT_STATUSES = ["לא התחיל", "בעריכה", "הושלם"] as const;
type EditStatus = typeof EDIT_STATUSES[number];

const EDIT_META: Record<EditStatus, { color: string; bg: string; border: string }> = {
  "לא התחיל": { color: "#64748b", bg: "#64748b12", border: "#64748b30" },
  "בעריכה":   { color: "#3b82f6", bg: "#3b82f612", border: "#3b82f630" },
  "הושלם":    { color: "#10b981", bg: "#10b98112", border: "#10b98130" },
};

const CONTENT_TYPES = ["רילס", "טיקטוק", "סטורי", "יוטיוב", "פוסט"];
const TEAM_MEMBERS  = ["ענב", "אוריאל", "דניאל"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function shootDayKind(sd: ShootDay): "upcoming" | "today" | "done" | "pending" {
  if (!sd.shoot_date) return "pending";
  const t = todayStr();
  if (sd.shoot_date > t)  return "upcoming";
  if (sd.shoot_date === t) return "today";
  return sd.status === "הושלם" ? "done" : "pending";
}

const KIND_STYLE = {
  upcoming: { border: "#3b82f6", bg: "#3b82f608", label: "מתוכנן",  lBg: "#3b82f615", lColor: "#2563eb" },
  today:    { border: "#f59e0b", bg: "#f59e0b08", label: "היום!",   lBg: "#fef3c7",   lColor: "#d97706" },
  done:     { border: "#10b981", bg: "#10b98108", label: "הושלם",   lBg: "#10b98115", lColor: "#059669" },
  pending:  { border: "#ef4444", bg: "#ef444408", label: "לא הושלם",lBg: "#ef444415", lColor: "#dc2626" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function ContentPage() {
  const navigate = useNavigate();
  const [shootDays, setShootDays]   = useState<ShootDay[]>([]);
  const [contacts,  setContacts]    = useState<Contact[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [showAdd,   setShowAdd]     = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter]         = useState<"הכל" | "מתוכנן" | "הושלם">("הכל");
  const [addForm, setAddForm]       = useState({ contact_id: "", shoot_date: todayStr() });

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const [{ data: sdData }, { data: vidData }, { data: cData }] = await Promise.all([
      supabase.from("shoot_days").select("*").order("shoot_date", { ascending: false, nullsFirst: false }),
      supabase.from("shoot_videos").select("*").order("position"),
      supabase.from("contacts").select("id,name,business_name").order("name"),
    ]);
    const days = (sdData ?? []) as Omit<ShootDay, "videos">[];
    const vids = (vidData ?? []) as ShootVideo[];
    const vidMap: Record<string, ShootVideo[]> = {};
    vids.forEach(v => { (vidMap[v.shoot_day_id] ??= []).push(v); });
    setShootDays(days.map(d => ({ ...d, videos: vidMap[d.id] ?? [] })));
    setContacts((cData ?? []) as Contact[]);
    setLoading(false);
  }

  const contactMap = useMemo(() => {
    const m: Record<string, Contact> = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const selected = useMemo(
    () => shootDays.find(d => d.id === selectedId) ?? null,
    [shootDays, selectedId]
  );

  const filtered = useMemo(() => {
    let list = [...shootDays];
    if (filter === "מתוכנן") list = list.filter(d => d.status === "מתוכנן");
    if (filter === "הושלם")  list = list.filter(d => d.status === "הושלם");
    const t = todayStr();
    return list.sort((a, b) => {
      const aFut = (a.shoot_date ?? "") >= t;
      const bFut = (b.shoot_date ?? "") >= t;
      if (aFut && !bFut) return -1;
      if (!aFut && bFut)  return 1;
      if (aFut) return (a.shoot_date ?? "").localeCompare(b.shoot_date ?? "");
      return (b.shoot_date ?? "").localeCompare(a.shoot_date ?? "");
    });
  }, [shootDays, filter]);

  const stats = useMemo(() => {
    const t = todayStr();
    const upcoming = shootDays.filter(d => (d.shoot_date ?? "") >= t).length;
    const allV = shootDays.flatMap(d => d.videos);
    return {
      upcoming,
      editing:    allV.filter(v => v.edit_status === "בעריכה").length,
      done:       allV.filter(v => v.edit_status === "הושלם").length,
      notStarted: allV.filter(v => v.edit_status === "לא התחיל").length,
    };
  }, [shootDays]);

  async function createShootDay() {
    if (!addForm.contact_id) { toast.error("חובה לבחור לקוח"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("shoot_days").insert({
      contact_id:     addForm.contact_id,
      shoot_date:     addForm.shoot_date || null,
      status:         "מתוכנן",
      creative_brief: null,
      updated_at:     new Date().toISOString(),
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setShowAdd(false);
    setAddForm({ contact_id: "", shoot_date: todayStr() });
    await load();
    if (data) setSelectedId((data as { id: string }).id);
    toast.success("יום צילום נוצר");
  }

  const patchDay = useCallback(async (id: string, patch: Partial<Omit<ShootDay, "videos">>) => {
    await supabase.from("shoot_days")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setShootDays(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  async function deleteDay(id: string) {
    if (!confirm("למחוק יום צילום זה וכל הסרטונים שלו?")) return;
    await supabase.from("shoot_days").delete().eq("id", id);
    setSelectedId(null);
    void load();
  }

  const addVideo = useCallback(async (dayId: string) => {
    const pos = shootDays.find(d => d.id === dayId)?.videos.length ?? 0;
    const { data, error } = await supabase.from("shoot_videos").insert({
      shoot_day_id: dayId,
      title:        "סרטון חדש",
      content_type: "רילס",
      edit_status:  "לא התחיל",
      position:     pos,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setShootDays(prev => prev.map(d =>
      d.id === dayId ? { ...d, videos: [...d.videos, data as ShootVideo] } : d
    ));
  }, [shootDays]);

  const patchVideo = useCallback(async (dayId: string, videoId: string, patch: Partial<ShootVideo>) => {
    await supabase.from("shoot_videos").update(patch).eq("id", videoId);
    setShootDays(prev => prev.map(d =>
      d.id === dayId
        ? { ...d, videos: d.videos.map(v => v.id === videoId ? { ...v, ...patch } : v) }
        : d
    ));
  }, []);

  const deleteVideo = useCallback(async (dayId: string, videoId: string) => {
    await supabase.from("shoot_videos").delete().eq("id", videoId);
    setShootDays(prev => prev.map(d =>
      d.id === dayId ? { ...d, videos: d.videos.filter(v => v.id !== videoId) } : d
    ));
  }, []);

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

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background px-6 py-4" style={{ direction: "rtl" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">תוכן — פרודקשן</h1>
            <p className="text-sm text-muted-foreground">ניהול ימי צילום, קריאייטיב וסרטונים</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-5 me-2 md:flex text-xs">
              <Stat icon={<Camera className="h-3.5 w-3.5 text-blue-500" />}
                value={stats.upcoming} label="קרובים" />
              <Stat icon={<Clock className="h-3.5 w-3.5 text-blue-500" />}
                value={stats.editing} label="בעריכה" />
              <Stat icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                value={stats.done} label="הושלמו" />
            </div>
            <Button size="sm" className="cursor-pointer h-9 gap-1.5"
              onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> יום צילום חדש
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex items-center gap-1">
          {(["הכל", "מתוכנן", "הושלם"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}>
              {f}
            </button>
          ))}
          <span className="ms-auto text-xs text-muted-foreground">{filtered.length} ימי צילום</span>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div className="flex" style={{ direction: "rtl" }}>

        {/* List */}
        <div className={cn(
          "flex-1 overflow-y-auto p-4 transition-all",
          selectedId && "hidden lg:block lg:w-[calc(100%-520px)]"
        )}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
              <Camera className="mb-3 h-10 w-10 opacity-10" />
              <p className="text-sm font-medium">אין ימי צילום</p>
              <Button size="sm" variant="outline" className="mt-4 cursor-pointer"
                onClick={() => setShowAdd(true)}>
                <Plus className="me-1.5 h-3.5 w-3.5" /> יום צילום חדש
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(sd => (
                <ShootDayCard
                  key={sd.id}
                  shootDay={sd}
                  contact={sd.contact_id ? (contactMap[sd.contact_id] ?? null) : null}
                  isSelected={selectedId === sd.id}
                  onClick={() => setSelectedId(selectedId === sd.id ? null : sd.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && selected && (
          <ShootDayDetail
            shootDay={selected}
            contact={selected.contact_id ? (contactMap[selected.contact_id] ?? null) : null}
            onClose={() => setSelectedId(null)}
            onPatchDay={patch => patchDay(selected.id, patch)}
            onDelete={() => void deleteDay(selected.id)}
            onAddVideo={() => void addVideo(selected.id)}
            onPatchVideo={(vid, patch) => void patchVideo(selected.id, vid, patch)}
            onDeleteVideo={vid => void deleteVideo(selected.id, vid)}
          />
        )}
      </div>

      {/* ── Add dialog ───────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={o => { if (!o) setShowAdd(false); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>יום צילום חדש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">לקוח *</label>
              <Select
                value={addForm.contact_id || "__none__"}
                onValueChange={v => setAddForm(f => ({ ...f, contact_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— בחר לקוח —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— בחר לקוח —</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.business_name ? ` · ${c.business_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">תאריך צילום מתוכנן</label>
              <Input type="date" dir="ltr"
                value={addForm.shoot_date}
                onChange={e => setAddForm(f => ({ ...f, shoot_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setShowAdd(false)}>ביטול</Button>
            <Button className="cursor-pointer" onClick={createShootDay} disabled={saving}>
              {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              צור יום צילום
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Shoot day card ────────────────────────────────────────────────────────────

function ShootDayCard({ shootDay, contact, isSelected, onClick }: {
  shootDay: ShootDay;
  contact: Contact | null;
  isSelected: boolean;
  onClick: () => void;
}) {
  const kind  = shootDayKind(shootDay);
  const style = KIND_STYLE[kind];
  const vids  = shootDay.videos;
  const notStarted = vids.filter(v => v.edit_status === "לא התחיל").length;
  const editing    = vids.filter(v => v.edit_status === "בעריכה").length;
  const done       = vids.filter(v => v.edit_status === "הושלם").length;

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-[1px]",
        isSelected ? "border-transparent" : "border-border"
      )}
      style={{
        borderRightWidth: 3,
        borderRightColor: style.border,
        background: isSelected ? style.bg : undefined,
        ...(isSelected ? { boxShadow: `0 0 0 2px ${style.border}35` } : {}),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Client + status badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              {contact?.name ?? "—"}
              {contact?.business_name ? (
                <span className="font-normal text-muted-foreground"> · {contact.business_name}</span>
              ) : null}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: style.lBg, color: style.lColor }}>
              {style.label}
            </span>
          </div>

          {/* Date */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            {shootDay.shoot_date
              ? new Date(shootDay.shoot_date + "T12:00:00").toLocaleDateString("he-IL", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })
              : "תאריך לא נקבע"}
          </div>

          {/* Creative brief preview */}
          {shootDay.creative_brief && (
            <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
              <FileText className="inline h-3 w-3 me-1 opacity-50" />
              {shootDay.creative_brief}
            </p>
          )}
        </div>

        <ChevronLeft className={cn(
          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform",
          isSelected && "rotate-90"
        )} />
      </div>

      {/* Video stats */}
      <div className="mt-3 flex items-center gap-2">
        <Video className="h-3 w-3 shrink-0 text-muted-foreground/30" />
        {vids.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/40">אין סרטונים עדיין</span>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {notStarted > 0 && (
                <VideoPill count={notStarted} status="לא התחיל" />
              )}
              {editing > 0 && (
                <VideoPill count={editing} status="בעריכה" />
              )}
              {done > 0 && (
                <VideoPill count={done} status="הושלם" />
              )}
            </div>
            <div className="ms-auto flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${(done / vids.length) * 100}%` }} />
              </div>
              <span className="tabular-nums">{done}/{vids.length}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shoot day detail panel ────────────────────────────────────────────────────

function ShootDayDetail({ shootDay, contact, onClose, onPatchDay, onDelete, onAddVideo, onPatchVideo, onDeleteVideo }: {
  shootDay: ShootDay;
  contact: Contact | null;
  onClose: () => void;
  onPatchDay: (patch: Partial<Omit<ShootDay, "videos">>) => Promise<void>;
  onDelete: () => void;
  onAddVideo: () => void;
  onPatchVideo: (videoId: string, patch: Partial<ShootVideo>) => void;
  onDeleteVideo: (videoId: string) => void;
}) {
  const [brief, setBrief] = useState(shootDay.creative_brief ?? "");
  useEffect(() => { setBrief(shootDay.creative_brief ?? ""); }, [shootDay.id, shootDay.creative_brief]);

  const kind  = shootDayKind(shootDay);
  const style = KIND_STYLE[kind];
  const done  = shootDay.videos.filter(v => v.edit_status === "הושלם").length;
  const total = shootDay.videos.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-start bg-black/25 backdrop-blur-[2px] lg:relative lg:inset-auto lg:z-auto lg:bg-transparent lg:backdrop-blur-none"
      onClick={e => { if (e.currentTarget === e.target) onClose(); }}
      style={{ direction: "rtl" }}
    >
      <div
        className="flex w-full max-w-[520px] flex-col overflow-hidden bg-background shadow-2xl lg:border-r lg:border-border lg:shadow-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4"
          style={{ borderRightWidth: 3, borderRightColor: style.border }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: style.lBg, color: style.lColor }}>
                  {style.label}
                </span>
              </div>
              <h2 className="mt-1.5 truncate text-lg font-bold text-foreground">
                {contact?.name ?? "—"}
              </h2>
              {contact?.business_name && (
                <p className="text-sm text-muted-foreground">{contact.business_name}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onDelete}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClose}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Date + status controls */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground shrink-0">תאריך צילום</label>
              <Input
                type="date" dir="ltr"
                defaultValue={shootDay.shoot_date ?? ""}
                key={shootDay.shoot_date ?? "no-date"}
                onBlur={e => {
                  const v = e.target.value || null;
                  if (v !== shootDay.shoot_date) void onPatchDay({ shoot_date: v });
                }}
                className="h-7 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["מתוכנן", "הושלם"] as const).map(s => (
                <button key={s}
                  onClick={() => void onPatchDay({ status: s })}
                  className={cn(
                    "cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
                    shootDay.status === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Creative brief */}
          <div className="border-b border-border px-5 py-4">
            <SectionHead icon={<FileText className="h-3.5 w-3.5" />} title="קריאייטיב בריף" />
            <Textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              onBlur={() => {
                const val = brief || null;
                if (val !== shootDay.creative_brief) void onPatchDay({ creative_brief: val });
              }}
              placeholder="רשום כאן רעיונות, הנחיות צילום, מסרים מרכזיים, תסריטים…"
              className="min-h-[150px] resize-none bg-muted/50 text-sm border-muted-foreground/20 focus:bg-background"
            />
          </div>

          {/* Videos */}
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionHead
                icon={<Video className="h-3.5 w-3.5" />}
                title={`סרטונים (${total})`}
              />
              <div className="flex items-center gap-3">
                {total > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {done}/{total} הושלמו
                  </span>
                )}
                <button onClick={onAddVideo}
                  className="cursor-pointer flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                  <Plus className="h-3.5 w-3.5" /> הוסף סרטון
                </button>
              </div>
            </div>

            {total === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border py-10 text-center">
                <Video className="mx-auto mb-2 h-7 w-7 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">לחץ "הוסף סרטון" לאחר יום הצילום</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shootDay.videos.map(video => (
                  <VideoRow
                    key={video.id}
                    video={video}
                    onSave={patch => onPatchVideo(video.id, patch)}
                    onDelete={() => onDeleteVideo(video.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video row ─────────────────────────────────────────────────────────────────

function VideoRow({ video, onSave, onDelete }: {
  video: ShootVideo;
  onSave: (patch: Partial<ShootVideo>) => void;
  onDelete: () => void;
}) {
  const [title,    setTitle]    = useState(video.title);
  const [link,     setLink]     = useState(video.drive_link ?? "");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setTitle(video.title); }, [video.id, video.title]);
  useEffect(() => { setLink(video.drive_link ?? ""); }, [video.id, video.drive_link]);

  const m   = EDIT_META[video.edit_status as EditStatus] ?? EDIT_META["לא התחיל"];
  const idx = EDIT_STATUSES.indexOf(video.edit_status as EditStatus);

  function cycleStatus() {
    const next = EDIT_STATUSES[(idx + 1) % EDIT_STATUSES.length];
    onSave({ edit_status: next });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-sm">
      {/* Main row */}
      <div className="group flex items-center gap-2 px-3 py-2.5">
        {/* Status cycle */}
        <button onClick={cycleStatus}
          title={video.edit_status}
          className="cursor-pointer shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
          style={{ color: m.color }}>
          {video.edit_status === "לא התחיל" && <Circle className="h-4 w-4" />}
          {video.edit_status === "בעריכה"   && <Clock className="h-4 w-4" />}
          {video.edit_status === "הושלם"    && <CheckCircle2 className="h-4 w-4" />}
        </button>

        {/* Title inline edit */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== video.title) onSave({ title: title.trim() }); }}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          placeholder="שם הסרטון"
        />

        {/* Type select */}
        <Select value={video.content_type} onValueChange={v => onSave({ content_type: v })}>
          <SelectTrigger className="h-6 w-[68px] shrink-0 border-0 bg-muted/60 px-1.5 text-[10px] cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Status badge */}
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
          {video.edit_status}
        </span>

        {/* Drive link quick icon */}
        {video.drive_link && (
          <a href={video.drive_link} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            onClick={e => e.stopPropagation()}>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)}
          className={cn(
            "cursor-pointer shrink-0 rounded p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
            expanded && "bg-muted text-foreground"
          )}>
          <Pencil className="h-3 w-3" />
        </button>

        {/* Delete */}
        <button onClick={onDelete}
          className="cursor-pointer shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-3 pb-3 pt-2.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Drive
            </label>
            <input
              type="url"
              value={link}
              dir="ltr"
              onChange={e => setLink(e.target.value)}
              onBlur={() => {
                const v = link.trim() || null;
                if (v !== video.drive_link) onSave({ drive_link: v });
              }}
              placeholder="https://drive.google.com/..."
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
            />
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              עורך
            </label>
            <Select
              value={video.assigned_editor ?? "__none__"}
              onValueChange={v => onSave({ assigned_editor: v === "__none__" ? null : v })}>
              <SelectTrigger className="h-7 flex-1 cursor-pointer text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {TEAM_MEMBERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function VideoPill({ count, status }: { count: number; status: EditStatus }) {
  const m = EDIT_META[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {count} {status}
    </span>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="font-bold text-foreground">{value}</span> {label}
    </span>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="opacity-70">{icon}</span>
      {title}
      <span className="flex-1 border-t border-border/60" />
    </div>
  );
}

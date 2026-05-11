import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Trash2, Users, ListChecks, LayoutGrid, BarChart3,
  Pencil, Settings2, ArrowUp, ArrowDown, CheckCircle2, Clock, AlertTriangle,
  Flame, Circle, CalendarDays, ChevronRight,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-session";
import { syncTeamMembers } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type InternalTask = {
  id: string; title: string; description: string | null;
  status: string; priority: string; due_date: string | null;
  plan_id: string | null; client_task_id: string | null;
  assignee_id: string | null; created_at: string;
  completed_at: string | null; sort_order: number;
};
type Member = { id: string; name: string; color: string | null; active: boolean };
type PlanLite = {
  id: string; name: string; slug: string; archived: boolean;
  accent_color: string | null; status_colors: Record<string, string> | null;
};
type ClientTaskLite = { id: string; title: string; plan_id: string };
type KanbanStatus = {
  id: string; status_key: string; label: string;
  color: string; position: number; is_done: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FALLBACK_STATUS_COLOR = "#94a3b8";

const PRIORITIES = [
  { id: "low", label: "נמוכה", color: "#64748b" },
  { id: "medium", label: "בינונית", color: "#3b82f6" },
  { id: "high", label: "גבוהה", color: "#f59e0b" },
  { id: "urgent", label: "דחופה", color: "#ef4444" },
] as const;

const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "נמוכה",   color: "#64748b", bg: "#64748b18" },
  medium: { label: "בינונית", color: "#3b82f6", bg: "#3b82f618" },
  high:   { label: "גבוהה",   color: "#f59e0b", bg: "#f59e0b18" },
  urgent: { label: "דחופה",   color: "#ef4444", bg: "#ef444418" },
};

// ─── Drop indicator ───────────────────────────────────────────────────────────

function DropIndicator({ color }: { color: string }) {
  return (
    <div className="my-1 flex items-center gap-1.5" aria-hidden>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}33` }} />
      <span className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}

// ─── Member avatar ────────────────────────────────────────────────────────────

function Avatar({ member, size = "sm" }: { member: Member; size?: "sm" | "md" }) {
  const c = member.color ?? "#64748b";
  const s = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-[10px]";
  return (
    <span className={cn("inline-flex items-center justify-center shrink-0 rounded-full font-semibold text-white", s)}
      style={{ backgroundColor: c }}>
      {member.name[0]}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function TeamPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"kanban" | "by-client" | "kpi">("kanban");
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [clientTasks, setClientTasks] = useState<ClientTaskLite[]>([]);
  const [statuses, setStatuses] = useState<KanbanStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<{ col: string; index: number } | null>(null);

  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<InternalTask> | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    setAuthed(true);
  }, [navigate]);

  async function loadAll() {
    const [m, t, p, ct, ks] = await Promise.all([
      supabase.from("team_members").select("*").order("created_at"),
      supabase.from("internal_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("id,name,slug,archived,accent_color,status_colors").order("name"),
      supabase.from("tasks").select("id,title,plan_id"),
      supabase.from("kanban_statuses").select("*").order("position"),
    ]);
    setMembers((m.data ?? []) as Member[]);
    setTasks((t.data ?? []) as InternalTask[]);
    setPlans((p.data ?? []) as unknown as PlanLite[]);
    setClientTasks((ct.data ?? []) as ClientTaskLite[]);
    setStatuses((ks.data ?? []) as KanbanStatus[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!authed) return;
    void syncTeamMembers().then(() => loadAll()).catch(() => loadAll());
    const ch = supabase.channel("team-internal")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_tasks" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const oldRow = payload.old as Partial<InternalTask>;
          const newRow = payload.new as Partial<InternalTask>;
          if (oldRow.status && newRow.status && oldRow.status !== newRow.status) {
            const label = statusLabelRef.current.get(newRow.status) ?? newRow.status;
            toast.info(`📌 "${newRow.title ?? "משימה"}" עברה ל${label}`);
          }
        }
        loadAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_statuses" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [authed]);

  const planMap = useMemo(() => { const m = new Map<string, PlanLite>(); plans.forEach(p => m.set(p.id, p)); return m; }, [plans]);
  const memberMap = useMemo(() => { const m = new Map<string, Member>(); members.forEach(mm => m.set(mm.id, mm)); return m; }, [members]);
  const clientTaskMap = useMemo(() => { const m = new Map<string, ClientTaskLite>(); clientTasks.forEach(c => m.set(c.id, c)); return m; }, [clientTasks]);
  const doneKeys = useMemo(() => new Set(statuses.filter(s => s.is_done).map(s => s.status_key)), [statuses]);
  const isDoneStatus = (key: string) => doneKeys.has(key);

  // Refs for notifications
  const statusLabelRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    statuses.forEach(s => m.set(s.status_key, s.label));
    statusLabelRef.current = m;
  }, [statuses]);

  // Deadline reminders: notify once per task per session
  const notifiedDeadlineRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!authed || tasks.length === 0) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ms = 86400000;
    tasks.forEach(t => {
      if (!t.due_date || isDoneStatus(t.status)) return;
      const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
      const days = Math.round((due.getTime() - today.getTime()) / ms);
      let key = "", msg = "";
      if (days < 0) { key = `over-${t.id}`; msg = `⚠️ "${t.title}" באיחור של ${Math.abs(days)} ימים`; }
      else if (days === 0) { key = `today-${t.id}`; msg = `🔔 "${t.title}" — דד-ליין היום!`; }
      else if (days === 1) { key = `tom-${t.id}`; msg = `⏰ "${t.title}" — דד-ליין מחר`; }
      else if (days <= 3) { key = `soon-${t.id}-${days}`; msg = `📅 "${t.title}" — בעוד ${days} ימים`; }
      if (key && !notifiedDeadlineRef.current.has(key)) {
        notifiedDeadlineRef.current.add(key);
        toast.warning(msg, { duration: 6000 });
      }
    });
  }, [tasks, authed, doneKeys]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (filterAssignee !== "all") {
      if (filterAssignee === "none" && t.assignee_id) return false;
      if (filterAssignee !== "none" && t.assignee_id !== filterAssignee) return false;
    }
    if (filterPlan !== "all") {
      if (filterPlan === "none" && t.plan_id) return false;
      if (filterPlan !== "none" && t.plan_id !== filterPlan) return false;
    }
    return true;
  }), [tasks, filterAssignee, filterPlan]);

  async function saveTask() {
    if (!editing || !editing.title?.trim()) { toast.error("חובה כותרת"); return; }
    setSavingTask(true);
    const payload = {
      title: editing.title.trim(), description: editing.description ?? null,
      status: editing.status ?? "todo", priority: editing.priority ?? "medium",
      due_date: editing.due_date || null, plan_id: editing.plan_id || null,
      client_task_id: editing.client_task_id || null, assignee_id: editing.assignee_id || null,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from("internal_tasks").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("internal_tasks").insert(payload));
    }
    setSavingTask(false);
    if (err) { toast.error("שגיאה: " + err.message); return; }
    toast.success(editing.id ? "עודכן" : "נוצר");
    setEditing(null);
  }

  async function quickStatus(id: string, status: string) {
    await supabase.from("internal_tasks").update({ status }).eq("id", id);
  }

  async function handleDrop(taskId: string, newStatus: string, targetIndex: number | null) {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    const colItems = tasks.filter(x => x.status === newStatus && x.id !== taskId).sort((a, b) => a.sort_order - b.sort_order);
    const idx = targetIndex == null || targetIndex < 0 || targetIndex > colItems.length ? colItems.length : targetIndex;
    const before = idx > 0 ? colItems[idx - 1].sort_order : null;
    const after = idx < colItems.length ? colItems[idx].sort_order : null;
    let newSort: number;
    if (before == null && after == null) newSort = 1000;
    else if (before == null) newSort = (after as number) - 1000;
    else if (after == null) newSort = (before as number) + 1000;
    else newSort = (before + after) / 2;
    if (t.status === newStatus && t.sort_order === newSort) return;
    setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: newStatus, sort_order: newSort } : x));
    const patch: { status: string; sort_order: number; completed_at?: string | null } = { status: newStatus, sort_order: newSort };
    if (newStatus !== t.status) {
      if (isDoneStatus(newStatus)) patch.completed_at = new Date().toISOString();
      else if (isDoneStatus(t.status)) patch.completed_at = null;
    }
    const { error } = await supabase.from("internal_tasks").update(patch).eq("id", taskId);
    if (error) { toast.error("שגיאה בעדכון: " + error.message); void loadAll(); }
  }

  async function deleteTask(id: string) {
    if (!confirm("למחוק משימה פנימית זו?")) return;
    await supabase.from("internal_tasks").delete().eq("id", id);
    toast.success("נמחקה");
  }

  async function addStatus() {
    const label = prompt("שם השלב החדש:")?.trim();
    if (!label) return;
    const key = `stage_${Date.now().toString(36)}`;
    const maxPos = statuses.reduce((m, s) => Math.max(m, s.position), -1);
    const palette = ["#94a3b8","#f59e0b","#dc2626","#16a34a","#3b82f6","#a855f7","#ec4899","#14b8a6"];
    const color = palette[(maxPos + 1) % palette.length];
    const { error } = await supabase.from("kanban_statuses").insert({ status_key: key, label, color, position: maxPos + 1, is_done: false });
    if (error) toast.error(error.message); else toast.success("שלב נוסף");
  }
  async function updateStatus(id: string, patch: Partial<KanbanStatus>) {
    const { error } = await supabase.from("kanban_statuses").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function removeStatus(s: KanbanStatus) {
    const inUse = tasks.filter(t => t.status === s.status_key).length;
    if (inUse > 0) { toast.error(`לא ניתן למחוק - ${inUse} משימות עדיין בשלב זה`); return; }
    if (!confirm(`למחוק את השלב "${s.label}"?`)) return;
    const { error } = await supabase.from("kanban_statuses").delete().eq("id", s.id);
    if (error) toast.error(error.message); else toast.success("השלב נמחק");
  }
  async function moveStatus(s: KanbanStatus, dir: -1 | 1) {
    const sorted = [...statuses].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(x => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await supabase.from("kanban_statuses").update({ position: other.position }).eq("id", s.id);
    await supabase.from("kanban_statuses").update({ position: s.position }).eq("id", other.id);
  }

  if (!authed || loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const kpi = (() => {
    const total = tasks.length;
    const done = tasks.filter(t => isDoneStatus(t.status)).length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const blocked = tasks.filter(t => t.status === "blocked").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(t => !isDoneStatus(t.status) && t.due_date && new Date(t.due_date) < today).length;
    const urgent = tasks.filter(t => t.priority === "urgent" && !isDoneStatus(t.status)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, blocked, overdue, urgent, pct };
  })();

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />
      <div className="min-h-screen px-4 py-6" style={{ direction: "rtl" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630" }}>
              <Users className="h-3 w-3" />
              ניהול צוות פנימי · רק לעיני הסוכנות
            </div>
            <h1 className="text-2xl font-bold text-foreground">משימות הצוות</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              משימות פנימיות מקושרות ללקוחות · הלקוחות לא רואים
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setShowStatuses(true)}>
              <Settings2 className="ms-1.5 h-3.5 w-3.5" /> שלבים
            </Button>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setShowMembers(true)}>
              <Users className="ms-1.5 h-3.5 w-3.5" /> צוות ({members.filter(m => m.active).length})
            </Button>
            <Button className="cursor-pointer" onClick={() => setEditing({ status: statuses[0]?.status_key ?? "todo", priority: "medium" })}>
              <Plus className="ms-1.5 h-4 w-4" /> משימה חדשה
            </Button>
          </div>
        </header>

        {/* ── KPI strip ────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="סה״כ" value={kpi.total} icon={<Circle className="h-4 w-4" />} iconBg="#6366f118" iconColor="#6366f1" />
          <KpiCard label="בתהליך" value={kpi.inProgress} icon={<Clock className="h-4 w-4" />} iconBg="#3b82f618" iconColor="#3b82f6" />
          <KpiCard label="חסום" value={kpi.blocked} icon={<AlertTriangle className="h-4 w-4" />} iconBg="#f59e0b18" iconColor="#f59e0b" />
          <KpiCard label="באיחור" value={kpi.overdue} icon={<CalendarDays className="h-4 w-4" />} iconBg="#ef444418" iconColor="#ef4444" urgent={kpi.overdue > 0} />
          <KpiCard label="דחופות" value={kpi.urgent} icon={<Flame className="h-4 w-4" />} iconBg="#ef444418" iconColor="#ef4444" urgent={kpi.urgent > 0} />
          <KpiCard label="הושלמו" value={kpi.done} icon={<CheckCircle2 className="h-4 w-4" />} iconBg="#10b98118" iconColor="#10b981" progress={kpi.pct} />
        </div>

        {/* ── Tabs + Filters ────────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="glass flex rounded-xl p-1 gap-0.5">
            <TabBtn active={tab === "kanban"} onClick={() => setTab("kanban")}>
              <LayoutGrid className="ms-1 h-3.5 w-3.5" /> Kanban
            </TabBtn>
            <TabBtn active={tab === "by-client"} onClick={() => setTab("by-client")}>
              <ListChecks className="ms-1 h-3.5 w-3.5" /> לפי לקוח
            </TabBtn>
            <TabBtn active={tab === "kpi"} onClick={() => setTab("kpi")}>
              <BarChart3 className="ms-1 h-3.5 w-3.5" /> KPI
            </TabBtn>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8 w-[150px] cursor-pointer text-xs">
                <SelectValue placeholder="כל הצוות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הצוות</SelectItem>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="h-8 w-[165px] cursor-pointer text-xs">
                <SelectValue placeholder="כל הלקוחות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                <SelectItem value="none">ללא לקוח</SelectItem>
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Kanban view ───────────────────────────────────────────────────── */}
        {tab === "kanban" && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(statuses.length, 1)}, minmax(0, 1fr))` }}>
            {statuses.map(s => {
              const items = filteredTasks.filter(t => t.status === s.status_key).sort((a, b) => a.sort_order - b.sort_order);
              const isOver = dragOverCol === s.status_key;
              return (
                <div key={s.id}
                  className={cn("glass flex flex-col rounded-xl p-2.5 transition-all", isOver && "ring-2")}
                  style={isOver ? { boxShadow: `0 0 0 2px ${s.color}55` } : {}}
                  onDragOver={e => {
                    if (!draggingId) return;
                    e.preventDefault(); e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== s.status_key) setDragOverCol(s.status_key);
                  }}
                  onDragLeave={e => { if (e.currentTarget === e.target) { setDragOverCol(null); setDropIndex(null); } }}
                  onDrop={e => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || draggingId;
                    const idx = dropIndex?.col === s.status_key ? dropIndex.index : null;
                    setDragOverCol(null); setDraggingId(null); setDropIndex(null);
                    if (id) void handleDrop(id, s.status_key, idx);
                  }}
                >
                  {/* Column header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}80` }} />
                      <span className="text-sm font-semibold text-foreground">{s.label}</span>
                    </div>
                    <span className="glass-subtle rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>

                  {/* Top accent line */}
                  <div className="mb-3 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}00)` }} />

                  {/* Cards */}
                  <div className="flex-1 space-y-2">
                    {items.map((t, i) => {
                      const showBefore = draggingId && dropIndex?.col === s.status_key && dropIndex.index === i && draggingId !== t.id;
                      return (
                        <div key={t.id}
                          onDragOver={e => {
                            if (!draggingId) return;
                            e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
                            const rect = e.currentTarget.getBoundingClientRect();
                            const newIdx = e.clientY < rect.top + rect.height / 2 ? i : i + 1;
                            if (dragOverCol !== s.status_key) setDragOverCol(s.status_key);
                            if (!dropIndex || dropIndex.col !== s.status_key || dropIndex.index !== newIdx)
                              setDropIndex({ col: s.status_key, index: newIdx });
                          }}
                        >
                          {showBefore && <DropIndicator color={s.color} />}
                          <InternalTaskCard
                            task={t}
                            member={t.assignee_id ? memberMap.get(t.assignee_id) : undefined}
                            plan={t.plan_id ? planMap.get(t.plan_id) : undefined}
                            clientTask={t.client_task_id ? clientTaskMap.get(t.client_task_id) : undefined}
                            statuses={statuses}
                            onEdit={() => setEditing(t)}
                            onDelete={() => deleteTask(t.id)}
                            onStatus={st => quickStatus(t.id, st)}
                            draggable
                            isDragging={draggingId === t.id}
                            onDragStart={e => { setDraggingId(t.id); e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDraggingId(null); setDragOverCol(null); setDropIndex(null); }}
                          />
                          {i === items.length - 1 && draggingId && dropIndex?.col === s.status_key && dropIndex.index === items.length && draggingId !== t.id && (
                            <DropIndicator color={s.color} />
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <>
                        {draggingId && dropIndex?.col === s.status_key && <DropIndicator color={s.color} />}
                        <div className="rounded-xl border-2 border-dashed py-8 text-center text-xs text-muted-foreground/50 transition-colors"
                          style={{ borderColor: isOver ? s.color + "60" : undefined }}>
                          {isOver ? "שחרר כאן" : "גרור משימה לכאן"}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Add button */}
                  <button
                    onClick={() => setEditing({ status: s.status_key, priority: "medium" })}
                    className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-xs text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> הוסף משימה
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── By-client view ───────────────────────────────────────────────── */}
        {tab === "by-client" && (
          <div className="space-y-4">
            {plans.filter(p => !p.archived).map(p => {
              const items = filteredTasks.filter(t => t.plan_id === p.id);
              if (items.length === 0 && filterPlan !== "all") return null;
              const done = items.filter(i => isDoneStatus(i.status)).length;
              const pct = items.length ? Math.round((done / items.length) * 100) : 0;
              const accent = p.accent_color ?? "#2D4A6B";
              return (
                <div key={p.id} className="glass overflow-hidden rounded-2xl">
                  {/* Plan header */}
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid oklch(0 0 0 / 0.06)" }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-xs font-bold"
                        style={{ backgroundColor: accent }}>
                        {p.name[0]}
                      </span>
                      <div>
                        <Link to="/p/$slug" params={{ slug: p.slug }}
                          className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer">
                          {p.name}
                          <ChevronRight className="h-3 w-3 opacity-50" />
                        </Link>
                        <div className="text-xs text-muted-foreground">{items.length} משימות · {done} הושלמו · {pct}%</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="cursor-pointer h-8 text-xs"
                      onClick={() => setEditing({ status: statuses[0]?.status_key ?? "todo", priority: "medium", plan_id: p.id })}>
                      <Plus className="ms-1 h-3 w-3" /> הוסף
                    </Button>
                  </div>
                  {/* Progress bar */}
                  <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${accent} ${pct}%, oklch(0 0 0 / 0.06) ${pct}%)` }} />
                  {/* Tasks */}
                  <div className="p-4">
                    {items.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-border py-6 text-center text-xs text-muted-foreground/50">
                        אין משימות פנימיות ללקוח זה
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(t => (
                          <InternalTaskCard key={t.id} task={t}
                            member={t.assignee_id ? memberMap.get(t.assignee_id) : undefined}
                            plan={undefined} clientTask={t.client_task_id ? clientTaskMap.get(t.client_task_id) : undefined}
                            statuses={statuses}
                            onEdit={() => setEditing(t)} onDelete={() => deleteTask(t.id)} onStatus={st => quickStatus(t.id, st)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Orphan tasks */}
            {(() => {
              const orphans = filteredTasks.filter(t => !t.plan_id);
              if (!orphans.length) return null;
              return (
                <div className="glass overflow-hidden rounded-2xl">
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid oklch(0 0 0 / 0.06)" }}>
                    <div className="text-sm font-semibold text-muted-foreground">ללא לקוח</div>
                  </div>
                  <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {orphans.map(t => (
                      <InternalTaskCard key={t.id} task={t}
                        member={t.assignee_id ? memberMap.get(t.assignee_id) : undefined}
                        plan={undefined} clientTask={undefined} statuses={statuses}
                        onEdit={() => setEditing(t)} onDelete={() => deleteTask(t.id)} onStatus={st => quickStatus(t.id, st)} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── KPI view ─────────────────────────────────────────────────────── */}
        {tab === "kpi" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Per-member */}
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#3b82f618" }}>
                  <Users className="h-3.5 w-3.5 text-[#3b82f6]" />
                </div>
                <span className="font-semibold text-foreground">לפי איש צוות</span>
              </div>
              <div className="space-y-3">
                {members.length === 0 && (
                  <div className="text-xs text-muted-foreground">אין חברי צוות. הוסף דרך כפתור ״צוות״ למעלה.</div>
                )}
                {members.map(m => {
                  const mTasks = tasks.filter(t => t.assignee_id === m.id);
                  const mDone = mTasks.filter(t => isDoneStatus(t.status)).length;
                  const pct = mTasks.length ? Math.round((mDone / mTasks.length) * 100) : 0;
                  const c = m.color ?? "#64748b";
                  return (
                    <div key={m.id} className="glass-subtle rounded-xl p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar member={m} />
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{mTasks.length - mDone} פתוחות</span>
                          <span className="text-[10px]">·</span>
                          <span className="font-semibold" style={{ color: c }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }} />
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const u = tasks.filter(t => !t.assignee_id);
                  if (!u.length) return null;
                  return (
                    <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                      ללא שיוך: {u.length} משימות
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Per-plan */}
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#8b5cf618" }}>
                  <ListChecks className="h-3.5 w-3.5 text-[#8b5cf6]" />
                </div>
                <span className="font-semibold text-foreground">לפי לקוח</span>
              </div>
              <div className="space-y-3">
                {plans.filter(p => !p.archived).map(p => {
                  const pTasks = tasks.filter(t => t.plan_id === p.id);
                  if (!pTasks.length) return null;
                  const pDone = pTasks.filter(t => isDoneStatus(t.status)).length;
                  const pct = Math.round((pDone / pTasks.length) * 100);
                  const c = p.accent_color ?? "#2D4A6B";
                  return (
                    <div key={p.id} className="glass-subtle rounded-xl p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Link to="/p/$slug" params={{ slug: p.slug }}
                          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors cursor-pointer">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{pTasks.length - pDone} פתוחות</span>
                          <span className="text-[10px]">·</span>
                          <span className="font-semibold" style={{ color: c }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}, ${c}bb)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New/Edit dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "עריכת משימה פנימית" : "משימה פנימית חדשה"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">כותרת *</label>
                <Input value={editing.title ?? ""} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="מה צריך לעשות?" autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) void saveTask(); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">תיאור</label>
                <Input value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="פרטים נוספים" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">סטטוס</label>
                  <Select value={editing.status ?? "todo"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map(s => (
                        <SelectItem key={s.id} value={s.status_key}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">דחיפות</label>
                  <Select value={editing.priority ?? "medium"} onValueChange={v => setEditing({ ...editing, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">דדליין</label>
                  <Input type="date" value={editing.due_date ?? ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">משויך ל</label>
                  <Select value={editing.assignee_id ?? "__none__"} onValueChange={v => setEditing({ ...editing, assignee_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ללא שיוך</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color ?? "#64748b" }} />
                            {m.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">לקוח</label>
                <Select value={editing.plan_id ?? "__none__"} onValueChange={v => setEditing({ ...editing, plan_id: v === "__none__" ? null : v, client_task_id: null })}>
                  <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא לקוח</SelectItem>
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editing.plan_id && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">מקושרת למשימת לקוח (אופציונלי)</label>
                  <Select value={editing.client_task_id ?? "__none__"} onValueChange={v => setEditing({ ...editing, client_task_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="בחר משימה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ללא קישור</SelectItem>
                      {clientTasks.filter(c => c.plan_id === editing.plan_id).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingTask} className="cursor-pointer">ביטול</Button>
            <Button onClick={saveTask} disabled={savingTask} className="cursor-pointer">
              {savingTask && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Members dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>חברי צוות</DialogTitle>
            <p className="text-xs text-muted-foreground">לחצו על מעגל הצבע לשינוי צבע ייחודי.</p>
          </DialogHeader>
          <div className="space-y-2">
            {members.map(m => <MemberRow key={m.id} member={m} />)}
            {members.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">אין חברי צוות — הוסיפו משתמשים בהגדרות</div>
            )}
          </div>
          <div className="mt-2 border-t border-border pt-3">
            <Link to="/settings" className="text-xs text-primary hover:underline cursor-pointer" onClick={() => setShowMembers(false)}>
              ← ניהול משתמשים בהגדרות
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Statuses dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showStatuses} onOpenChange={setShowStatuses}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שלבי לוח המשימות</DialogTitle>
            <p className="text-xs text-muted-foreground">ערכו שמות וצבעים, הוסיפו או הסירו שלבים. סמנו "סיום" לסיום.</p>
          </DialogHeader>
          <div className="space-y-2">
            {statuses.slice().sort((a, b) => a.position - b.position).map((s, i, arr) => (
              <StatusRow key={s.id} status={s} isFirst={i === 0} isLast={i === arr.length - 1}
                onUpdate={patch => updateStatus(s.id, patch)}
                onRemove={() => removeStatus(s)}
                onMoveUp={() => moveStatus(s, -1)}
                onMoveDown={() => moveStatus(s, 1)} />
            ))}
            {statuses.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">אין שלבים מוגדרים</div>}
            <Button variant="outline" className="w-full cursor-pointer" onClick={addStatus}>
              <Plus className="ms-2 h-4 w-4" /> הוסף שלב חדש
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, iconBg, iconColor, urgent, progress }: {
  label: string; value: number;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  urgent?: boolean; progress?: number;
}) {
  return (
    <div className={cn("glass glass-top rounded-2xl p-4 transition-all", urgent && value > 0 && "ring-1 ring-[#ef4444]/30")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        {progress !== undefined && (
          <span className="text-[10px] font-medium" style={{ color: iconColor }}>{progress}%</span>
        )}
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", urgent && value > 0 ? "text-[#ef4444]" : "text-foreground")}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: iconColor }} />
        </div>
      )}
    </div>
  );
}

// ─── TabBtn ───────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
      active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    )}>
      {children}
    </button>
  );
}

// ─── InternalTaskCard ─────────────────────────────────────────────────────────

function InternalTaskCard({ task, member, plan, clientTask, statuses, onEdit, onDelete, onStatus, draggable, isDragging, onDragStart, onDragEnd }: {
  task: InternalTask; member?: Member; plan?: PlanLite; clientTask?: ClientTaskLite;
  statuses: KanbanStatus[];
  onEdit: () => void; onDelete: () => void; onStatus: (s: string) => void;
  draggable?: boolean; isDragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentStatus = statuses.find(s => s.status_key === task.status);
  const isDoneTask = currentStatus?.is_done ?? false;
  const isOverdue = task.due_date && !isDoneTask && new Date(task.due_date) < today;
  const statusColor = currentStatus?.color ?? FALLBACK_STATUS_COLOR;
  const memberColor = member?.color ?? "#64748b";
  const planAccent = plan?.accent_color ?? null;
  const pMeta = PRIORITY_META[task.priority];

  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-150",
        "hover:shadow-md hover:-translate-y-[1px]",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-95 ring-2 ring-primary"
      )}
      style={{ borderInlineStartWidth: 3, borderInlineStartStyle: "solid", borderInlineStartColor: statusColor }}
    >
      {/* Top row */}
      <div className="flex items-start gap-2 p-2.5 pb-0">
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-medium leading-snug text-foreground", isDoneTask && "line-through opacity-50")}>
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={onEdit} className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 pt-1.5">
        {/* Priority */}
        {pMeta && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ background: pMeta.bg, color: pMeta.color }}>
            {pMeta.label}
          </span>
        )}
        {/* Member */}
        {member && (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: memberColor + "18", color: memberColor, border: `1px solid ${memberColor}30` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: memberColor }} />
            {member.name}
          </span>
        )}
        {/* Plan */}
        {plan && (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: (planAccent ?? "#2D4A6B") + "18", color: planAccent ?? "#2D4A6B", border: `1px solid ${(planAccent ?? "#2D4A6B")}30` }}>
            {plan.name}
          </span>
        )}
        {/* Client task link */}
        {clientTask && (
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ↳ {clientTask.title.slice(0, 18)}{clientTask.title.length > 18 ? "…" : ""}
          </span>
        )}
        {/* Due date */}
        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
            isOverdue ? "bg-red-50 text-red-500 font-medium" : "bg-muted text-muted-foreground")}>
            <CalendarDays className="h-2.5 w-2.5" />
            {new Date(task.due_date).toLocaleDateString("he-IL")}
          </span>
        )}
      </div>

      {/* Status selector */}
      <div className="px-2.5 pb-2.5 pt-2">
        <Select value={task.status} onValueChange={onStatus}>
          <SelectTrigger className="h-7 w-full cursor-pointer text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => (
              <SelectItem key={s.id} value={s.status_key}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({ member }: { member: Member }) {
  const [name, setName] = useState(member.name);
  const [color, setColor] = useState(member.color ?? "#64748b");

  useEffect(() => { setName(member.name); setColor(member.color ?? "#64748b"); }, [member.name, member.color]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === member.name) { setName(member.name); return; }
    const { error } = await supabase.from("team_members").update({ name: trimmed }).eq("id", member.id);
    if (error) toast.error(error.message); else toast.success("השם עודכן");
  }

  async function saveColor(c: string) {
    setColor(c);
    const { error } = await supabase.from("team_members").update({ color: c }).eq("id", member.id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <ColorPicker value={color} onChange={saveColor} size="sm" />
      <Input value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        className="h-8 flex-1 text-sm" />
    </div>
  );
}

// ─── StatusRow ────────────────────────────────────────────────────────────────

function StatusRow({ status, isFirst, isLast, onUpdate, onRemove, onMoveUp, onMoveDown }: {
  status: KanbanStatus; isFirst: boolean; isLast: boolean;
  onUpdate: (patch: Partial<KanbanStatus>) => void | Promise<void>;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color);

  useEffect(() => { setLabel(status.label); setColor(status.color); }, [status.label, status.color]);

  function saveLabel() {
    const trimmed = label.trim();
    if (!trimmed || trimmed === status.label) { setLabel(status.label); return; }
    void onUpdate({ label: trimmed });
  }

  function saveColor(c: string) { setColor(c); void onUpdate({ color: c }); }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <ColorPicker value={color} onChange={saveColor} size="sm" />
      <Input value={label} onChange={e => setLabel(e.target.value)} onBlur={saveLabel}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        className="h-8 flex-1 text-sm" />
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
        <input type="checkbox" checked={status.is_done} onChange={e => void onUpdate({ is_done: e.target.checked })} className="h-3.5 w-3.5 cursor-pointer accent-primary" />
        סיום
      </label>
      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" disabled={isFirst} onClick={onMoveUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" disabled={isLast} onClick={onMoveDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

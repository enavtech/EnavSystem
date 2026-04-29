import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  ArrowLeft,
  Trash2,
  Users,
  ListChecks,
  LayoutGrid,
  BarChart3,
  Pencil,
  Settings2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});

type InternalTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  plan_id: string | null;
  client_task_id: string | null;
  assignee_id: string | null;
  created_at: string;
  completed_at: string | null;
};
type Member = { id: string; name: string; color: string | null; active: boolean };
type PlanLite = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  accent_color: string | null;
  status_colors: Record<string, string> | null;
};
type ClientTaskLite = { id: string; title: string; plan_id: string };

type KanbanStatus = {
  id: string;
  status_key: string;
  label: string;
  color: string;
  position: number;
  is_done: boolean;
};

const FALLBACK_STATUS_COLOR = "#94a3b8";

const PRIORITIES = [
  { id: "low", label: "נמוכה" },
  { id: "medium", label: "בינונית" },
  { id: "high", label: "גבוהה" },
  { id: "urgent", label: "דחופה" },
] as const;

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent text-accent-foreground",
  high: "bg-warning/15 text-warning-foreground",
  urgent: "bg-urgent/15 text-urgent",
};

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

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");

  // New / edit task dialog
  const [editing, setEditing] = useState<Partial<InternalTask> | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  // Members dialog
  const [showMembers, setShowMembers] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

  // Statuses (Kanban stages) dialog
  const [showStatuses, setShowStatuses] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      navigate({ to: "/login" });
      return;
    }
    setAuthed(true);
  }, [navigate]);

  async function loadAll() {
    const [m, t, p, ct, ks] = await Promise.all([
      supabase.from("team_members").select("*").order("created_at"),
      supabase.from("internal_tasks").select("*").order("created_at", { ascending: false }),
      supabase
        .from("plans")
        .select("id,name,slug,archived,accent_color,status_colors")
        .order("name"),
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
    void loadAll();
    const ch = supabase
      .channel("team-internal")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_tasks" }, () =>
        loadAll()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () =>
        loadAll()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_statuses" }, () =>
        loadAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authed]);

  const planMap = useMemo(() => {
    const m = new Map<string, PlanLite>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);
  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((mm) => m.set(mm.id, mm));
    return m;
  }, [members]);
  const clientTaskMap = useMemo(() => {
    const m = new Map<string, ClientTaskLite>();
    clientTasks.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientTasks]);
  const statusMap = useMemo(() => {
    const m = new Map<string, KanbanStatus>();
    statuses.forEach((s) => m.set(s.status_key, s));
    return m;
  }, [statuses]);
  const doneKeys = useMemo(
    () => new Set(statuses.filter((s) => s.is_done).map((s) => s.status_key)),
    [statuses]
  );
  function statusColorOf(key: string) {
    return statusMap.get(key)?.color ?? FALLBACK_STATUS_COLOR;
  }
  function statusLabelOf(key: string) {
    return statusMap.get(key)?.label ?? key;
  }
  function isDoneStatus(key: string) {
    return doneKeys.has(key);
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterAssignee !== "all") {
        if (filterAssignee === "none" && t.assignee_id) return false;
        if (filterAssignee !== "none" && t.assignee_id !== filterAssignee) return false;
      }
      if (filterPlan !== "all") {
        if (filterPlan === "none" && t.plan_id) return false;
        if (filterPlan !== "none" && t.plan_id !== filterPlan) return false;
      }
      return true;
    });
  }, [tasks, filterAssignee, filterPlan]);

  async function saveTask() {
    if (!editing || !editing.title?.trim()) {
      toast.error("חובה כותרת");
      return;
    }
    setSavingTask(true);
    const payload = {
      title: editing.title.trim(),
      description: editing.description ?? null,
      status: editing.status ?? "todo",
      priority: editing.priority ?? "medium",
      due_date: editing.due_date || null,
      plan_id: editing.plan_id || null,
      client_task_id: editing.client_task_id || null,
      assignee_id: editing.assignee_id || null,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from("internal_tasks").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("internal_tasks").insert(payload));
    }
    setSavingTask(false);
    if (err) {
      toast.error("שגיאה: " + err.message);
      return;
    }
    toast.success(editing.id ? "עודכן" : "נוצר");
    setEditing(null);
  }

  async function quickStatus(id: string, status: string) {
    await supabase.from("internal_tasks").update({ status }).eq("id", id);
  }

  async function handleDrop(taskId: string, newStatus: string) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === newStatus) return;
    // Optimistic update
    setTasks((prev) =>
      prev.map((x) => (x.id === taskId ? { ...x, status: newStatus } : x))
    );
    const patch: { status: string; completed_at?: string | null } = { status: newStatus };
    if (isDoneStatus(newStatus)) patch.completed_at = new Date().toISOString();
    else if (isDoneStatus(t.status)) patch.completed_at = null;
    const { error } = await supabase
      .from("internal_tasks")
      .update(patch)
      .eq("id", taskId);
    if (error) {
      toast.error("שגיאה בעדכון: " + error.message);
      void loadAll();
    }
  }
  async function deleteTask(id: string) {
    if (!confirm("למחוק משימה פנימית זו?")) return;
    await supabase.from("internal_tasks").delete().eq("id", id);
    toast.success("נמחקה");
  }

  async function addMember() {
    if (!newMemberName.trim()) return;
    const { error } = await supabase
      .from("team_members")
      .insert({ name: newMemberName.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success("חבר/ת צוות נוסף/ה");
      setNewMemberName("");
    }
  }
  async function removeMember(id: string) {
    if (!confirm("להסיר חבר/ת צוות?")) return;
    await supabase.from("team_members").delete().eq("id", id);
  }

  if (!authed || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // KPI calc
  const kpi = (() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.due_date &&
        new Date(t.due_date).getTime() < today.getTime()
    ).length;
    const urgent = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
    return { total, done, inProgress, blocked, overdue, urgent };
  })();

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              to="/"
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
              חזרה לדשבורד
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Users className="h-3 w-3" />
              ניהול צוות פנימי · רק לעיני הסוכנות
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              משימות הצוות שלי
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              משימות פנימיות מקושרות למשימות הלקוח. הלקוחות לא רואים אותן.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMembers(true)}>
              <Users className="ms-2 h-4 w-4" /> צוות ({members.filter((m) => m.active).length})
            </Button>
            <Button onClick={() => setEditing({ status: "todo", priority: "medium" })}>
              <Plus className="ms-2 h-4 w-4" /> משימה חדשה
            </Button>
          </div>
        </header>

        {/* KPI strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Kpi label="סה״כ" value={kpi.total} />
          <Kpi label="בתהליך" value={kpi.inProgress} accent="primary" />
          <Kpi label="חסום" value={kpi.blocked} accent="warning" />
          <Kpi label="באיחור" value={kpi.overdue} accent="urgent" />
          <Kpi label="דחופות" value={kpi.urgent} accent="urgent" />
          <Kpi label="הושלמו" value={kpi.done} accent="success" />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 text-xs">
            <TabBtn active={tab === "kanban"} onClick={() => setTab("kanban")}>
              <LayoutGrid className="ms-1 h-3 w-3" /> Kanban
            </TabBtn>
            <TabBtn active={tab === "by-client"} onClick={() => setTab("by-client")}>
              <ListChecks className="ms-1 h-3 w-3" /> לפי לקוח
            </TabBtn>
            <TabBtn active={tab === "kpi"} onClick={() => setTab("kpi")}>
              <BarChart3 className="ms-1 h-3 w-3" /> KPI
            </TabBtn>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="צוות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הצוות</SelectItem>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="לקוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                <SelectItem value="none">ללא לקוח</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Views */}
        {tab === "kanban" && (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.max(statuses.length, 1)}, minmax(220px, 1fr))`,
            }}
          >
            {statuses.map((s) => {
              const items = filteredTasks.filter((t) => t.status === s.status_key);
              const col = s.color;
              const isOver = dragOverCol === s.status_key;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-muted/30 p-3 transition-colors",
                    isOver ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"
                  )}
                  style={{ borderTop: `3px solid ${col}` }}
                  onDragOver={(e) => {
                    if (draggingId) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverCol !== s.status_key) setDragOverCol(s.status_key);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) setDragOverCol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || draggingId;
                    setDragOverCol(null);
                    setDraggingId(null);
                    if (id) void handleDrop(id, s.status_key);
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: col }}
                      />
                      {s.label}
                    </div>
                    <div className="rounded-full bg-card px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {items.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map((t) => (
                      <InternalTaskCard
                        key={t.id}
                        task={t}
                        member={t.assignee_id ? memberMap.get(t.assignee_id) : undefined}
                        plan={t.plan_id ? planMap.get(t.plan_id) : undefined}
                        clientTask={
                          t.client_task_id ? clientTaskMap.get(t.client_task_id) : undefined
                        }
                        planStatusColors={
                          t.plan_id ? planMap.get(t.plan_id)?.status_colors ?? null : null
                        }
                        onEdit={() => setEditing(t)}
                        onDelete={() => deleteTask(t.id)}
                        onStatus={(st) => quickStatus(t.id, st)}
                        draggable
                        isDragging={draggingId === t.id}
                        onDragStart={(e) => {
                          setDraggingId(t.id);
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                        {isOver ? "שחרר כאן" : "ריק · גרור משימה"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "by-client" && (
          <div className="space-y-4">
            {plans
              .filter((p) => !p.archived)
              .map((p) => {
                const items = filteredTasks.filter((t) => t.plan_id === p.id);
                if (items.length === 0 && filterPlan !== "all") return null;
                const done = items.filter((i) => i.status === "done").length;
                return (
                  <Card
                    key={p.id}
                    className="overflow-hidden p-4"
                    style={{
                      borderInlineStartWidth: 4,
                      borderInlineStartStyle: "solid",
                      borderInlineStartColor: p.accent_color ?? "#2D4A6B",
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: p.accent_color ?? "#2D4A6B" }}
                          />
                          <Link
                            to="/p/$slug"
                            params={{ slug: p.slug }}
                            className="text-base font-semibold text-foreground hover:text-primary"
                          >
                            {p.name}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {items.length} משימות פנימיות · {done} הושלמו
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            status: "todo",
                            priority: "medium",
                            plan_id: p.id,
                          })
                        }
                      >
                        <Plus className="ms-1 h-3 w-3" /> הוסף
                      </Button>
                    </div>
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                        אין משימות פנימיות ללקוח זה
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {items.map((t) => (
                          <InternalTaskCard
                            key={t.id}
                            task={t}
                            member={
                              t.assignee_id ? memberMap.get(t.assignee_id) : undefined
                            }
                            plan={undefined}
                            planStatusColors={p.status_colors}
                            clientTask={
                              t.client_task_id ? clientTaskMap.get(t.client_task_id) : undefined
                            }
                            onEdit={() => setEditing(t)}
                            onDelete={() => deleteTask(t.id)}
                            onStatus={(st) => quickStatus(t.id, st)}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            {/* Tasks not linked to any plan */}
            {(() => {
              const orphans = filteredTasks.filter((t) => !t.plan_id);
              if (orphans.length === 0) return null;
              return (
                <Card className="p-4">
                  <div className="mb-3 text-base font-semibold text-foreground">ללא לקוח</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {orphans.map((t) => (
                      <InternalTaskCard
                        key={t.id}
                        task={t}
                        member={t.assignee_id ? memberMap.get(t.assignee_id) : undefined}
                        plan={undefined}
                        clientTask={undefined}
                        onEdit={() => setEditing(t)}
                        onDelete={() => deleteTask(t.id)}
                        onStatus={(st) => quickStatus(t.id, st)}
                      />
                    ))}
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {tab === "kpi" && (
          <div className="space-y-6">
            {/* Per-member */}
            <Card className="p-5">
              <div className="mb-4 text-sm font-semibold text-foreground">לפי איש צוות</div>
              <div className="space-y-2">
                {members.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    אין חברי צוות. הוסף דרך כפתור ״צוות״ למעלה.
                  </div>
                )}
                {members.map((m) => {
                  const mTasks = tasks.filter((t) => t.assignee_id === m.id);
                  const mDone = mTasks.filter((t) => t.status === "done").length;
                  const mOpen = mTasks.length - mDone;
                  const pct = mTasks.length
                    ? Math.round((mDone / mTasks.length) * 100)
                    : 0;
                  const c = m.color ?? "#64748b";
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border p-3"
                      style={{
                        borderInlineStartWidth: 4,
                        borderInlineStartStyle: "solid",
                        borderInlineStartColor: c,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span
                            className="h-3 w-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: c }}
                          />
                          {m.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mOpen} פתוחות · {mDone} הושלמו · {pct}%
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: c }}
                        />
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const u = tasks.filter((t) => !t.assignee_id);
                  if (u.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                      ללא שיוך: {u.length} משימות
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* Per-plan */}
            <Card className="p-5">
              <div className="mb-4 text-sm font-semibold text-foreground">לפי לקוח</div>
              <div className="space-y-2">
                {plans
                  .filter((p) => !p.archived)
                  .map((p) => {
                    const pTasks = tasks.filter((t) => t.plan_id === p.id);
                    if (pTasks.length === 0) return null;
                    const pDone = pTasks.filter((t) => t.status === "done").length;
                    const pct = Math.round((pDone / pTasks.length) * 100);
                    const c = p.accent_color ?? "#2D4A6B";
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-border p-3"
                        style={{
                          borderInlineStartWidth: 4,
                          borderInlineStartStyle: "solid",
                          borderInlineStartColor: c,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to="/p/$slug"
                            params={{ slug: p.slug }}
                            className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                          >
                            <span
                              className="h-3 w-3 rounded-full ring-1 ring-border"
                              style={{ backgroundColor: c }}
                            />
                            {p.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {pTasks.length - pDone} פתוחות · {pDone} הושלמו · {pct}%
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: c }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* New/Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "עריכת משימה פנימית" : "משימה פנימית חדשה"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">כותרת</label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="מה לעשות"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">תיאור</label>
                <Input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="פרטים נוספים"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">סטטוס</label>
                  <Select
                    value={editing.status ?? "todo"}
                    onValueChange={(v) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERNAL_STATUSES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">דחיפות</label>
                  <Select
                    value={editing.priority ?? "medium"}
                    onValueChange={(v) => setEditing({ ...editing, priority: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">דדליין</label>
                  <Input
                    type="date"
                    value={editing.due_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">משויכת ל</label>
                  <Select
                    value={editing.assignee_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, assignee_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא שיוך</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">לקוח</label>
                <Select
                  value={editing.plan_id ?? "none"}
                  onValueChange={(v) =>
                    setEditing({
                      ...editing,
                      plan_id: v === "none" ? null : v,
                      client_task_id: null,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא לקוח</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.plan_id && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    מקושרת למשימת לקוח (אופציונלי)
                  </label>
                  <Select
                    value={editing.client_task_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, client_task_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="בחר משימה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא קישור</SelectItem>
                      {clientTasks
                        .filter((c) => c.plan_id === editing.plan_id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingTask}>
              ביטול
            </Button>
            <Button onClick={saveTask} disabled={savingTask}>
              {savingTask && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>חברי צוות</DialogTitle>
            <p className="text-xs text-muted-foreground">
              לחצו על מעגל הצבע שליד כל שם כדי להגדיר צבע ייחודי לחבר/ת הצוות. הצבע יופיע על משימותיהם.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="שם חבר/ת צוות"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember();
                  }
                }}
              />
              <Button onClick={addMember}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onRemove={() => removeMember(m.id)}
                />
              ))}
              {members.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  אין חברי צוות עדיין
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "urgent" | "warning";
}) {
  const color =
    accent === "primary"
      ? "text-primary"
      : accent === "success"
        ? "text-success"
        : accent === "urgent"
          ? "text-urgent"
          : accent === "warning"
            ? "text-warning-foreground"
            : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}

function InternalTaskCard({
  task,
  member,
  plan,
  clientTask,
  planStatusColors,
  onEdit,
  onDelete,
  onStatus,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: InternalTask;
  member?: Member;
  plan?: PlanLite;
  clientTask?: ClientTaskLite;
  planStatusColors?: Record<string, string> | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (s: string) => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    task.due_date &&
    task.status !== "done" &&
    new Date(task.due_date).getTime() < today.getTime();

  const statusColor = internalStatusColor(task.status, planStatusColors);
  const memberColor = member?.color ?? "#64748b";
  const planAccent = plan?.accent_color ?? null;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 ring-2 ring-primary"
      )}
      style={{
        borderInlineStartWidth: 3,
        borderInlineStartStyle: "solid",
        borderInlineStartColor: statusColor,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{task.title}</div>
          {task.description && (
            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-medium",
            PRIORITY_STYLE[task.priority] ?? "bg-muted"
          )}
        >
          {PRIORITIES.find((p) => p.id === task.priority)?.label}
        </span>
        {member && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium"
            style={{
              backgroundColor: memberColor + "22",
              color: memberColor,
              border: `1px solid ${memberColor}55`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: memberColor }}
            />
            {member.name}
          </span>
        )}
        {plan && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium"
            style={{
              backgroundColor: (planAccent ?? "#2D4A6B") + "18",
              color: planAccent ?? "#2D4A6B",
              border: `1px solid ${(planAccent ?? "#2D4A6B")}40`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: planAccent ?? "#2D4A6B" }}
            />
            {plan.name}
          </span>
        )}
        {clientTask && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
            ↳ {clientTask.title}
          </span>
        )}
        {task.due_date && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5",
              isOverdue ? "bg-urgent/15 text-urgent" : "bg-muted text-muted-foreground"
            )}
          >
            {new Date(task.due_date).toLocaleDateString("he-IL")}
          </span>
        )}
      </div>

      <div className="mt-2">
        <Select value={task.status} onValueChange={onStatus}>
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERNAL_STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onRemove,
}: {
  member: Member;
  onRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [color, setColor] = useState(member.color ?? "#64748b");

  // Keep local state in sync if the realtime row updates.
  useEffect(() => {
    setName(member.name);
    setColor(member.color ?? "#64748b");
  }, [member.name, member.color]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === member.name) {
      setName(member.name);
      return;
    }
    const { error } = await supabase
      .from("team_members")
      .update({ name: trimmed })
      .eq("id", member.id);
    if (error) toast.error(error.message);
    else toast.success("השם עודכן");
  }

  async function saveColor(c: string) {
    setColor(c);
    const { error } = await supabase
      .from("team_members")
      .update({ color: c })
      .eq("id", member.id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <ColorPicker value={color} onChange={saveColor} size="sm" />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 flex-1 text-sm"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

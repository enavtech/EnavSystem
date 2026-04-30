import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Target,
  Check,
  Trash2,
  Pencil,
  ArrowLeft,
  Calendar,
  Users,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/goals")({
  component: GoalsPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────

type Goal = {
  id: string;
  title: string;
  description: string | null;
  period_type: "quarterly" | "monthly" | "weekly";
  period_start: string;
  period_end: string;
  parent_id: string | null;
  status: "active" | "completed" | "cancelled";
  progress: number;
  color: string | null;
  position: number;
  created_at: string;
};

type Member = { id: string; name: string; color: string | null; active: boolean };

type WeekTask = {
  id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  goal_id: string | null;
  due_date: string | null;
};

// ─── Period utilities ──────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday-first (Israel)
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getQuarterStart(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

function getQuarterEnd(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), (q + 1) * 3, 0);
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function fmtQuarter(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `רבעון ${q} · ${d.getFullYear()}`;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const GOAL_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

// ─── Main Page ─────────────────────────────────────────────────────────────

function GoalsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [weekTasks, setWeekTasks] = useState<WeekTask[]>([]);

  const [refDate, setRefDate] = useState(() => new Date());

  // Create/edit dialog
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    goal?: Goal;
    periodType: "quarterly" | "monthly" | "weekly";
  } | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProgress, setEditProgress] = useState("0");
  const [editColor, setEditColor] = useState(GOAL_COLORS[0]);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Breakdown dialog
  const [breakdownGoal, setBreakdownGoal] = useState<Goal | null>(null);
  const [breakdownTasks, setBreakdownTasks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin()) {
      navigate({ to: "/login" });
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refDate]);

  async function loadAll() {
    const wStart = dateToStr(getWeekStart(refDate));
    const wEnd = dateToStr(addDays(getWeekStart(refDate), 6));
    const [g, m, t] = await Promise.all([
      supabase.from("team_goals").select("*").order("position").order("created_at"),
      supabase.from("team_members").select("*").eq("active", true).order("created_at"),
      supabase
        .from("internal_tasks")
        .select("id,title,status,assignee_id,goal_id,due_date")
        .gte("due_date", wStart)
        .lte("due_date", wEnd),
    ]);
    setGoals((g.data ?? []) as unknown as Goal[]);
    setMembers((m.data ?? []) as Member[]);
    setWeekTasks((t.data ?? []) as unknown as WeekTask[]);
    setLoading(false);
  }

  // ── Derived periods ──────────────────────────────────────────────────────

  const periods = useMemo(() => {
    const wStart = getWeekStart(refDate);
    const wEnd = addDays(wStart, 6);
    const mStart = getMonthStart(refDate);
    const mEnd = getMonthEnd(refDate);
    const qStart = getQuarterStart(refDate);
    const qEnd = getQuarterEnd(refDate);
    return {
      week: {
        start: wStart,
        end: wEnd,
        startStr: dateToStr(wStart),
        endStr: dateToStr(wEnd),
        label: `${fmtShort(wStart)} – ${fmtShort(wEnd)}`,
      },
      month: {
        start: mStart,
        end: mEnd,
        startStr: dateToStr(mStart),
        label: fmtMonth(mStart),
      },
      quarter: {
        start: qStart,
        end: qEnd,
        startStr: dateToStr(qStart),
        label: fmtQuarter(qStart),
      },
    };
  }, [refDate]);

  const weekGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.period_type === "weekly" && g.period_start === periods.week.startStr
      ),
    [goals, periods]
  );
  const monthGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.period_type === "monthly" && g.period_start === periods.month.startStr
      ),
    [goals, periods]
  );
  const quarterGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.period_type === "quarterly" &&
          g.period_start === periods.quarter.startStr
      ),
    [goals, periods]
  );

  const goalMap = useMemo(() => {
    const m = new Map<string, Goal>();
    goals.forEach((g) => m.set(g.id, g));
    return m;
  }, [goals]);

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>();
    members.forEach((mm) => m.set(mm.id, mm));
    return m;
  }, [members]);

  const tasksByMember = useMemo(() => {
    const map = new Map<string, WeekTask[]>();
    weekTasks.forEach((t) => {
      const key = t.assignee_id ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [weekTasks]);

  // ── Dialog helpers ───────────────────────────────────────────────────────

  function openCreate(periodType: "quarterly" | "monthly" | "weekly") {
    setEditDialog({ open: true, periodType });
    setEditTitle("");
    setEditDesc("");
    setEditProgress("0");
    setEditColor(GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)]);
    setEditParentId(null);
  }

  function openEdit(goal: Goal) {
    setEditDialog({ open: true, goal, periodType: goal.period_type });
    setEditTitle(goal.title);
    setEditDesc(goal.description ?? "");
    setEditProgress(String(goal.progress));
    setEditColor(goal.color ?? GOAL_COLORS[0]);
    setEditParentId(goal.parent_id);
  }

  async function saveGoal() {
    if (!editDialog || !editTitle.trim()) {
      toast.error("חובה להזין כותרת");
      return;
    }
    setSaving(true);
    const { periodType } = editDialog;
    let pStart: Date, pEnd: Date;
    if (periodType === "weekly") {
      pStart = periods.week.start;
      pEnd = periods.week.end;
    } else if (periodType === "monthly") {
      pStart = periods.month.start;
      pEnd = periods.month.end;
    } else {
      pStart = periods.quarter.start;
      pEnd = periods.quarter.end;
    }
    const payload = {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      period_type: periodType,
      period_start: dateToStr(pStart),
      period_end: dateToStr(pEnd),
      parent_id: editParentId || null,
      progress: Math.max(0, Math.min(100, parseInt(editProgress, 10) || 0)),
      color: editColor,
      updated_at: new Date().toISOString(),
    };
    if (editDialog.goal) {
      const { error } = await supabase
        .from("team_goals")
        .update(payload)
        .eq("id", editDialog.goal.id);
      if (error) toast.error("שגיאה בשמירה");
    } else {
      const pos = goals.filter(
        (g) => g.period_type === periodType && g.period_start === payload.period_start
      ).length;
      const { error } = await supabase
        .from("team_goals")
        .insert({ ...payload, position: pos });
      if (error) toast.error("שגיאה ביצירה");
    }
    setSaving(false);
    setEditDialog(null);
    void loadAll();
  }

  async function toggleComplete(goal: Goal) {
    const newStatus = goal.status === "completed" ? "active" : "completed";
    await supabase
      .from("team_goals")
      .update({
        status: newStatus,
        progress: newStatus === "completed" ? 100 : goal.progress,
      })
      .eq("id", goal.id);
    void loadAll();
  }

  async function deleteGoal(id: string) {
    if (!confirm("למחוק את היעד הזה?")) return;
    await supabase.from("team_goals").delete().eq("id", id);
    void loadAll();
  }

  async function createBreakdownTasks() {
    if (!breakdownGoal) return;
    const entries = Object.entries(breakdownTasks).filter(([, title]) =>
      title.trim()
    );
    if (!entries.length) {
      toast.error("לא הוזנו משימות");
      return;
    }
    setSaving(true);
    const rows = entries.map(([memberId, title]) => ({
      title: title.trim(),
      assignee_id: memberId === "__none__" ? null : memberId,
      goal_id: breakdownGoal.id,
      due_date: periods.week.endStr,
      status: "todo",
      priority: "medium",
    }));
    const { error } = await supabase.from("internal_tasks").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("שגיאה ביצירת המשימות");
      return;
    }
    toast.success(`נוצרו ${rows.length} משימות לשבוע`);
    setBreakdownGoal(null);
    setBreakdownTasks({});
    void loadAll();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableParents =
    editDialog?.periodType === "weekly"
      ? monthGoals
      : editDialog?.periodType === "monthly"
        ? quarterGoals
        : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            חזרה לדשבורד
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/team"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Users className="h-3.5 w-3.5" />
              משימות הצוות
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate((d) => addDays(d, -7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate(new Date())}
            >
              <Calendar className="me-1 h-3.5 w-3.5" />
              היום
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate((d) => addDays(d, 7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Header */}
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            תכנון אסטרטגי
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">יעדי הצוות</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            שבוע {periods.week.label} · {periods.month.label} · {periods.quarter.label}
          </p>
        </header>

        {/* 3-column goals grid */}
        <div className="mb-10 grid gap-5 lg:grid-cols-3">
          <GoalColumn
            title="יעדים רבעוניים"
            periodLabel={periods.quarter.label}
            goals={quarterGoals}
            goalMap={goalMap}
            onAdd={() => openCreate("quarterly")}
            onEdit={openEdit}
            onToggle={toggleComplete}
            onDelete={deleteGoal}
            showBreakdown={false}
          />
          <GoalColumn
            title="יעדים חודשיים"
            periodLabel={periods.month.label}
            goals={monthGoals}
            goalMap={goalMap}
            onAdd={() => openCreate("monthly")}
            onEdit={openEdit}
            onToggle={toggleComplete}
            onDelete={deleteGoal}
            showBreakdown={false}
          />
          <GoalColumn
            title="יעדים שבועיים"
            periodLabel={periods.week.label}
            goals={weekGoals}
            goalMap={goalMap}
            onAdd={() => openCreate("weekly")}
            onEdit={openEdit}
            onToggle={toggleComplete}
            onDelete={deleteGoal}
            showBreakdown
            onBreakdown={(g) => {
              setBreakdownGoal(g);
              setBreakdownTasks({});
            }}
          />
        </div>

        {/* Weekly tasks by member */}
        <section>
          <h2 className="mb-4 text-base font-semibold">
            משימות השבוע לפי חבר צוות
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              {periods.week.label}
            </span>
          </h2>
          {tasksByMember.size === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Target className="mx-auto mb-2 h-8 w-8 opacity-25" />
              <p>אין משימות לשבוע זה.</p>
              <p className="mt-1 text-xs">
                לחץ על{" "}
                <Target className="inline h-3 w-3" />{" "}
                ביעד שבועי כדי לפרוס משימות לחברי הצוות.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from(tasksByMember.entries()).map(([memberId, mTasks]) => {
                const member =
                  memberId !== "__none__" ? memberMap.get(memberId) : null;
                const name = member?.name ?? "ללא שיוך";
                const color = member?.color ?? "#94a3b8";
                const done = mTasks.filter((t) => t.status === "done").length;
                return (
                  <Card key={memberId} className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-medium">{name}</span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {done}/{mTasks.length}
                      </span>
                    </div>
                    {/* Mini progress bar */}
                    {mTasks.length > 0 && (
                      <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[oklch(0.55_0.13_160)] transition-all"
                          style={{ width: `${Math.round((done / mTasks.length) * 100)}%` }}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {mTasks.map((t) => (
                        <div key={t.id} className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                              t.status === "done"
                                ? "bg-[oklch(0.55_0.13_160)]"
                                : "bg-muted-foreground/40"
                            )}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-[13px] leading-snug",
                              t.status === "done" &&
                                "text-muted-foreground line-through"
                            )}
                          >
                            {t.title}
                          </span>
                          {t.goal_id && goalMap.has(t.goal_id) && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                              style={{
                                backgroundColor:
                                  (goalMap.get(t.goal_id)!.color ?? "#94a3b8") + "22",
                                color:
                                  goalMap.get(t.goal_id)!.color ?? "#94a3b8",
                              }}
                            >
                              {goalMap.get(t.goal_id)!.title.slice(0, 16)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Edit / Create dialog ─────────────────────────────────────────── */}
      {editDialog?.open && (
        <Dialog open onOpenChange={() => setEditDialog(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editDialog.goal
                  ? "עריכת יעד"
                  : `יעד חדש — ${
                      editDialog.periodType === "quarterly"
                        ? "רבעוני"
                        : editDialog.periodType === "monthly"
                          ? "חודשי"
                          : "שבועי"
                    }`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  כותרת *
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="מה רוצים להשיג?"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) void saveGoal();
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  תיאור (אופציונלי)
                </label>
                <Textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="פרוט נוסף…"
                  className="min-h-[60px] text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  התקדמות — {editProgress}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editProgress}
                  onChange={(e) => setEditProgress(e.target.value)}
                  className="w-full accent-primary"
                />
              </div>
              {availableParents.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    יעד אב (אופציונלי)
                  </label>
                  <Select
                    value={editParentId ?? ""}
                    onValueChange={(v) => setEditParentId(v || null)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="ללא" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא</SelectItem>
                      {availableParents.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  צבע
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-all",
                        editColor === c
                          ? "scale-110 border-foreground shadow-sm"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDialog(null)}>
                ביטול
              </Button>
              <Button
                onClick={saveGoal}
                disabled={saving || !editTitle.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editDialog.goal ? (
                  "שמור שינויים"
                ) : (
                  "צור יעד"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Breakdown to tasks dialog ────────────────────────────────────── */}
      {breakdownGoal && (
        <Dialog open onOpenChange={() => setBreakdownGoal(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>פרוס למשימות</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <p className="text-sm">
                יעד:{" "}
                <span className="font-medium">{breakdownGoal.title}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                הזן משימה לכל חבר צוות לשבוע {periods.week.label}:
              </p>
            </div>
            <div className="max-h-[50vh] space-y-2.5 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: m.color ?? "#94a3b8" }}
                  />
                  <span className="w-20 shrink-0 truncate text-sm font-medium">
                    {m.name}
                  </span>
                  <Input
                    value={breakdownTasks[m.id] ?? ""}
                    onChange={(e) =>
                      setBreakdownTasks((prev) => ({
                        ...prev,
                        [m.id]: e.target.value,
                      }))
                    }
                    placeholder="תיאור המשימה…"
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  אין חברי צוות פעילים. הוסף חברי צוות מדף{" "}
                  <Link to="/team" className="underline">
                    הצוות
                  </Link>
                  .
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setBreakdownGoal(null)}>
                ביטול
              </Button>
              <Button
                onClick={createBreakdownTasks}
                disabled={
                  saving ||
                  !Object.values(breakdownTasks).some((t) => t.trim())
                }
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Target className="me-1.5 h-4 w-4" />
                    צור משימות
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── GoalColumn ────────────────────────────────────────────────────────────

function GoalColumn({
  title,
  periodLabel,
  goals,
  goalMap,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  showBreakdown,
  onBreakdown,
}: {
  title: string;
  periodLabel: string;
  goals: Goal[];
  goalMap: Map<string, Goal>;
  onAdd: () => void;
  onEdit: (g: Goal) => void;
  onToggle: (g: Goal) => void;
  onDelete: (id: string) => void;
  showBreakdown: boolean;
  onBreakdown?: (g: Goal) => void;
}) {
  const done = goals.filter((g) => g.status === "completed").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {goals.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {done}/{goals.length}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {goals.length === 0 ? (
        <button
          onClick={onAdd}
          className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus className="mx-auto mb-1.5 h-5 w-5 opacity-40" />
          הוסף יעד
        </button>
      ) : (
        goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            parentGoal={g.parent_id ? goalMap.get(g.parent_id) : undefined}
            onEdit={onEdit}
            onToggle={onToggle}
            onDelete={onDelete}
            showBreakdown={showBreakdown}
            onBreakdown={onBreakdown}
          />
        ))
      )}
    </div>
  );
}

// ─── GoalCard ──────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  parentGoal,
  onEdit,
  onToggle,
  onDelete,
  showBreakdown,
  onBreakdown,
}: {
  goal: Goal;
  parentGoal?: Goal;
  onEdit: (g: Goal) => void;
  onToggle: (g: Goal) => void;
  onDelete: (id: string) => void;
  showBreakdown: boolean;
  onBreakdown?: (g: Goal) => void;
}) {
  const isDone = goal.status === "completed";
  const color = goal.color ?? "#94a3b8";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-opacity",
        isDone && "opacity-60"
      )}
    >
      {/* Color accent strip (RTL: right side) */}
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-1"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start gap-2 pe-2">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(goal)}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
          style={{
            borderColor: color,
            backgroundColor: isDone ? color : "transparent",
            color: "white",
          }}
        >
          {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-sm font-medium leading-snug",
              isDone && "text-muted-foreground line-through"
            )}
          >
            {goal.title}
          </div>
          {goal.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {goal.description}
            </p>
          )}
          {parentGoal && (
            <span
              className="mt-1.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: (parentGoal.color ?? "#94a3b8") + "20",
                color: parentGoal.color ?? "#94a3b8",
              }}
            >
              ↑ {parentGoal.title.slice(0, 24)}
            </span>
          )}
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${goal.progress}%`, backgroundColor: color }}
              />
            </div>
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {goal.progress}%
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-0.5">
          {showBreakdown && onBreakdown && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="פרוס למשימות"
              onClick={() => onBreakdown(goal)}
            >
              <Target className="h-3.5 w-3.5 text-primary" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onEdit(goal)}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onDelete(goal.id)}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-urgent" />
          </Button>
        </div>
      </div>
    </div>
  );
}

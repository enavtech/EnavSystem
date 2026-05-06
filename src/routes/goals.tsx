import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Loader2, ChevronLeft, ChevronRight, Target, Check,
  Trash2, Pencil, Calendar, ChevronDown,
} from "lucide-react";
import { isAdmin } from "@/lib/admin-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/goals")({
  component: GoalsPage,
});

// ─── Types ──────────────────────────────────────────────────────────────────

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
  id: string; title: string; status: string;
  assignee_id: string | null; goal_id: string | null; due_date: string | null;
};

// ─── Period utilities ────────────────────────────────────────────────────────

function getWeekStart(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); r.setDate(r.getDate() - r.getDay()); return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function getMonthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function getMonthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function getQuarterStart(d: Date) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); }
function getQuarterEnd(d: Date)   { return new Date(d.getFullYear(), (Math.floor(d.getMonth() / 3) + 1) * 3, 0); }
function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtShort(d: Date)   { return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" }); }
function fmtMonth(d: Date)   { return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }); }
function fmtQuarter(d: Date) { return `רבעון ${Math.floor(d.getMonth() / 3) + 1} · ${d.getFullYear()}`; }

const GOAL_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#f97316","#ec4899"];

// ─── Main page ───────────────────────────────────────────────────────────────

function GoalsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [weekTasks, setWeekTasks] = useState<WeekTask[]>([]);
  const [refDate, setRefDate] = useState(() => new Date());

  // Create/edit dialog
  const [editDialog, setEditDialog] = useState<{
    open: boolean; goal?: Goal; periodType: "quarterly" | "monthly" | "weekly";
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
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void loadAll();
  }, []);

  useEffect(() => { void loadAll(); }, [refDate]);

  async function loadAll() {
    const wStart = dateToStr(getWeekStart(refDate));
    const wEnd   = dateToStr(addDays(getWeekStart(refDate), 6));
    const [g, m, t] = await Promise.all([
      supabase.from("team_goals").select("*").order("position").order("created_at"),
      supabase.from("team_members").select("*").eq("active", true).order("created_at"),
      supabase.from("internal_tasks")
        .select("id,title,status,assignee_id,goal_id,due_date")
        .gte("due_date", wStart).lte("due_date", wEnd),
    ]);
    setGoals((g.data ?? []) as unknown as Goal[]);
    setMembers((m.data ?? []) as Member[]);
    setWeekTasks((t.data ?? []) as unknown as WeekTask[]);
    setLoading(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const periods = useMemo(() => {
    const wStart = getWeekStart(refDate), wEnd = addDays(wStart, 6);
    const mStart = getMonthStart(refDate), mEnd = getMonthEnd(refDate);
    const qStart = getQuarterStart(refDate), qEnd = getQuarterEnd(refDate);
    return {
      week:    { start: wStart, end: wEnd,   startStr: dateToStr(wStart), endStr: dateToStr(wEnd), label: `${fmtShort(wStart)} – ${fmtShort(wEnd)}` },
      month:   { start: mStart, end: mEnd,   startStr: dateToStr(mStart), label: fmtMonth(mStart) },
      quarter: { start: qStart, end: qEnd,   startStr: dateToStr(qStart), label: fmtQuarter(qStart) },
    };
  }, [refDate]);

  const quarterGoals = useMemo(() =>
    goals.filter(g => g.period_type === "quarterly" && g.period_start === periods.quarter.startStr),
    [goals, periods]);
  const monthGoals = useMemo(() =>
    goals.filter(g => g.period_type === "monthly" && g.period_start === periods.month.startStr),
    [goals, periods]);
  const weekGoals = useMemo(() =>
    goals.filter(g => g.period_type === "weekly" && g.period_start === periods.week.startStr),
    [goals, periods]);

  const goalMap = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);

  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const tasksByMember = useMemo(() => {
    const map = new Map<string, WeekTask[]>();
    weekTasks.forEach(t => {
      const k = t.assignee_id ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [weekTasks]);

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  function openCreate(periodType: "quarterly" | "monthly" | "weekly", parentId?: string | null) {
    setEditDialog({ open: true, periodType });
    setEditTitle(""); setEditDesc(""); setEditProgress("0");
    setEditColor(GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)]);
    setEditParentId(parentId ?? null);
  }

  function openEdit(goal: Goal) {
    setEditDialog({ open: true, goal, periodType: goal.period_type });
    setEditTitle(goal.title); setEditDesc(goal.description ?? "");
    setEditProgress(String(goal.progress)); setEditColor(goal.color ?? GOAL_COLORS[0]);
    setEditParentId(goal.parent_id);
  }

  async function saveGoal() {
    if (!editDialog || !editTitle.trim()) { toast.error("חובה להזין כותרת"); return; }
    setSaving(true);
    const { periodType } = editDialog;
    const pStart = periodType === "weekly" ? periods.week.start
      : periodType === "monthly" ? periods.month.start : periods.quarter.start;
    const pEnd   = periodType === "weekly" ? periods.week.end
      : periodType === "monthly" ? periods.month.end : periods.quarter.end;
    const payload = {
      title: editTitle.trim(), description: editDesc.trim() || null,
      period_type: periodType, period_start: dateToStr(pStart), period_end: dateToStr(pEnd),
      parent_id: editParentId || null,
      progress: Math.max(0, Math.min(100, parseInt(editProgress, 10) || 0)),
      color: editColor, updated_at: new Date().toISOString(),
    };
    if (editDialog.goal) {
      const { error } = await supabase.from("team_goals").update(payload).eq("id", editDialog.goal.id);
      if (error) toast.error("שגיאה בשמירה");
    } else {
      const pos = goals.filter(g => g.period_type === periodType && g.period_start === payload.period_start).length;
      const { error } = await supabase.from("team_goals").insert({ ...payload, position: pos });
      if (error) toast.error("שגיאה ביצירה");
    }
    setSaving(false);
    setEditDialog(null);
    void loadAll();
  }

  async function toggleComplete(goal: Goal) {
    const s = goal.status === "completed" ? "active" : "completed";
    await supabase.from("team_goals").update({ status: s, progress: s === "completed" ? 100 : goal.progress }).eq("id", goal.id);
    void loadAll();
  }

  async function deleteGoal(id: string) {
    if (!confirm("למחוק את היעד הזה?")) return;
    await supabase.from("team_goals").delete().eq("id", id);
    void loadAll();
  }

  async function createBreakdownTasks() {
    if (!breakdownGoal) return;
    const entries = Object.entries(breakdownTasks).filter(([, t]) => t.trim());
    if (!entries.length) { toast.error("לא הוזנו משימות"); return; }
    setSaving(true);
    const { error } = await supabase.from("internal_tasks").insert(
      entries.map(([memberId, title]) => ({
        title: title.trim(), assignee_id: memberId === "__none__" ? null : memberId,
        goal_id: breakdownGoal.id, due_date: periods.week.endStr,
        status: "todo", priority: "medium",
      }))
    );
    setSaving(false);
    if (error) { toast.error("שגיאה ביצירת המשימות"); return; }
    toast.success(`נוצרו ${entries.length} משימות לשבוע`);
    setBreakdownGoal(null); setBreakdownTasks({});
    void loadAll();
  }

  if (loading) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  const availableParents = editDialog?.periodType === "weekly" ? monthGoals
    : editDialog?.periodType === "monthly" ? quarterGoals : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />
      <div className="min-h-screen px-7 py-6" style={{ direction: "rtl" }}>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">תכנון אסטרטגי</div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">יעדי הצוות</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              שבוע {periods.week.label} · {periods.month.label} · {periods.quarter.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefDate(d => addDays(d, -7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRefDate(new Date())}>
              <Calendar className="me-1 h-3.5 w-3.5" />היום
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRefDate(d => addDays(d, 7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 3-column goals grid */}
        <div className="mb-8 grid gap-4 lg:grid-cols-3">

          {/* ── Quarterly column ───────────────────────────────────────── */}
          <div className="glass rounded-2xl p-4">
            <ColumnHeader
              title="יעדים רבעוניים"
              label={periods.quarter.label}
              goals={quarterGoals}
              accent="#6366f1"
              onAdd={() => openCreate("quarterly")}
            />
            <div className="mt-3 space-y-0.5">
              {quarterGoals.length === 0 && (
                <EmptyGoals onAdd={() => openCreate("quarterly")} />
              )}
              {quarterGoals.map(g => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  onEdit={openEdit}
                  onToggle={toggleComplete}
                  onDelete={deleteGoal}
                  onAddChild={g2 => openCreate("monthly", g2.id)}
                  addChildLabel="+ חודשי"
                />
              ))}
            </div>
          </div>

          {/* ── Monthly column — grouped by Q parent ───────────────────── */}
          <div className="glass rounded-2xl p-4">
            <ColumnHeader
              title="יעדים חודשיים"
              label={periods.month.label}
              goals={monthGoals}
              accent="#8b5cf6"
              onAdd={() => openCreate("monthly")}
            />
            <div className="mt-3">
              <GroupedGoals
                goals={monthGoals}
                parents={quarterGoals}
                goalMap={goalMap}
                childType="monthly"
                onEdit={openEdit}
                onToggle={toggleComplete}
                onDelete={deleteGoal}
                onAddChild={parent => openCreate("monthly", parent.id)}
                addChildLabel="+ חודשי"
                onAddOrphan={() => openCreate("monthly")}
              />
            </div>
          </div>

          {/* ── Weekly column — grouped by M parent ────────────────────── */}
          <div className="glass rounded-2xl p-4">
            <ColumnHeader
              title="יעדים שבועיים"
              label={periods.week.label}
              goals={weekGoals}
              accent="#3b82f6"
              onAdd={() => openCreate("weekly")}
            />
            <div className="mt-3">
              <GroupedGoals
                goals={weekGoals}
                parents={monthGoals}
                goalMap={goalMap}
                childType="weekly"
                onEdit={openEdit}
                onToggle={toggleComplete}
                onDelete={deleteGoal}
                onBreakdown={g => { setBreakdownGoal(g); setBreakdownTasks({}); }}
                onAddOrphan={() => openCreate("weekly")}
              />
            </div>
          </div>

        </div>

        {/* Weekly tasks by member */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            משימות השבוע לפי חבר צוות
            <span className="text-sm font-normal text-muted-foreground">{periods.week.label}</span>
          </h2>
          {tasksByMember.size === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Target className="mx-auto mb-2 h-8 w-8 opacity-25" />
              <p>אין משימות לשבוע זה.</p>
              <p className="mt-1 text-xs">לחץ על <Target className="inline h-3 w-3" /> ביעד שבועי כדי לפרוס משימות לחברי הצוות.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from(tasksByMember.entries()).map(([memberId, mTasks]) => {
                const member = memberId !== "__none__" ? memberMap.get(memberId) : null;
                const color = member?.color ?? "#94a3b8";
                const done = mTasks.filter(t => t.status === "done").length;
                return (
                  <Card key={memberId} className="p-4">
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium">{member?.name ?? "ללא שיוך"}</span>
                      <span className="ms-auto text-xs text-muted-foreground">{done}/{mTasks.length}</span>
                    </div>
                    <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${mTasks.length ? Math.round((done / mTasks.length) * 100) : 0}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {mTasks.map(t => (
                        <div key={t.id} className="flex items-start gap-2">
                          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", t.status === "done" ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                          <span className={cn("min-w-0 flex-1 text-[13px] leading-snug", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                          {t.goal_id && goalMap.has(t.goal_id) && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium" style={{
                              backgroundColor: (goalMap.get(t.goal_id)!.color ?? "#94a3b8") + "22",
                              color: goalMap.get(t.goal_id)!.color ?? "#94a3b8",
                            }}>
                              {goalMap.get(t.goal_id)!.title.slice(0, 14)}
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

      {/* ── Edit / Create dialog ─────────────────────────────────────────────── */}
      {editDialog?.open && (
        <Dialog open onOpenChange={() => setEditDialog(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editDialog.goal ? "עריכת יעד" : `יעד חדש — ${editDialog.periodType === "quarterly" ? "רבעוני" : editDialog.periodType === "monthly" ? "חודשי" : "שבועי"}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">כותרת *</label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="מה רוצים להשיג?" autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) void saveGoal(); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">תיאור (אופציונלי)</label>
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="פרוט נוסף…" className="min-h-[60px] text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">התקדמות — {editProgress}%</label>
                <input type="range" min={0} max={100} step={5} value={editProgress}
                  onChange={e => setEditProgress(e.target.value)} className="w-full accent-primary" />
              </div>
              {availableParents.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">יעד אב</label>
                  <Select value={editParentId ?? ""} onValueChange={v => setEditParentId(v || null)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="ללא" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא</SelectItem>
                      {availableParents.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">צבע</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)}
                      className={cn("h-7 w-7 rounded-full border-2 transition-all", editColor === c ? "scale-110 border-foreground shadow-sm" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditDialog(null)}>ביטול</Button>
              <Button onClick={saveGoal} disabled={saving || !editTitle.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editDialog.goal ? "שמור שינויים" : "צור יעד"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Breakdown dialog ──────────────────────────────────────────────────── */}
      {breakdownGoal && (
        <Dialog open onOpenChange={() => setBreakdownGoal(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>פרוס למשימות שבועיות</DialogTitle></DialogHeader>
            <div className="space-y-1 mb-2">
              <p className="text-sm">יעד: <span className="font-medium">{breakdownGoal.title}</span></p>
              <p className="text-xs text-muted-foreground">הזן משימה לכל חבר צוות לשבוע {periods.week.label}:</p>
            </div>
            <div className="max-h-[50vh] space-y-2.5 overflow-y-auto">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.color ?? "#94a3b8" }} />
                  <span className="w-20 shrink-0 truncate text-sm font-medium">{m.name}</span>
                  <Input value={breakdownTasks[m.id] ?? ""}
                    onChange={e => setBreakdownTasks(p => ({ ...p, [m.id]: e.target.value }))}
                    placeholder="תיאור המשימה…" className="h-8 text-sm" />
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  אין חברי צוות פעילים. הוסף מדף <Link to="/team" className="underline">הצוות</Link>.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setBreakdownGoal(null)}>ביטול</Button>
              <Button onClick={createBreakdownTasks} disabled={saving || !Object.values(breakdownTasks).some(t => t.trim())}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Target className="me-1.5 h-4 w-4" />צור משימות</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

// ─── ColumnHeader ────────────────────────────────────────────────────────────

function ColumnHeader({ title, label, goals, accent, onAdd }: {
  title: string; label: string; goals: Goal[]; accent: string; onAdd: () => void;
}) {
  const done = goals.filter(g => g.status === "completed").length;
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <p className="ms-4 text-[11px] text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        {goals.length > 0 && (
          <span className="text-[11px] text-muted-foreground">{done}/{goals.length}</span>
        )}
        <button onClick={onAdd}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── GroupedGoals — monthly grouped by Q parent, weekly grouped by M parent ──

function GroupedGoals({ goals, parents, goalMap, childType, onEdit, onToggle, onDelete, onBreakdown, onAddChild, addChildLabel, onAddOrphan }: {
  goals: Goal[];
  parents: Goal[];
  goalMap: Map<string, Goal>;
  childType: "monthly" | "weekly";
  onEdit: (g: Goal) => void;
  onToggle: (g: Goal) => void;
  onDelete: (id: string) => void;
  onBreakdown?: (g: Goal) => void;
  onAddChild?: (parent: Goal) => void;
  addChildLabel?: string;
  onAddOrphan: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setCollapsed(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // Build groups: one per parent that exists
  const groups: { parent: Goal | null; children: Goal[] }[] = [];

  // Linked groups — for each parent that has at least one child
  const byParent = new Map<string, Goal[]>();
  goals.forEach(g => {
    const k = g.parent_id ?? "__orphan__";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(g);
  });

  // Show all parents (even those with 0 children) so user can derive from them
  parents.forEach(p => {
    groups.push({ parent: p, children: byParent.get(p.id) ?? [] });
  });

  // Orphans (no parent) — only if they exist
  const orphans = byParent.get("__orphan__") ?? [];

  if (groups.length === 0 && orphans.length === 0) {
    return <EmptyGoals onAdd={onAddOrphan} />;
  }

  return (
    <div className="space-y-3">
      {groups.map(({ parent, children }) => {
        if (!parent) return null;
        const col = parent.color ?? "#94a3b8";
        const isCollapsed = collapsed.has(parent.id);
        const doneCount = children.filter(g => g.status === "completed").length;
        return (
          <div key={parent.id}>
            {/* Section header */}
            <div className="mb-1 flex items-center gap-1.5">
              <button onClick={() => toggle(parent.id)} className="flex items-center gap-1.5 min-w-0 flex-1 text-right">
                <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform", isCollapsed && "-rotate-90")} />
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                <span className="truncate text-[11px] font-medium text-muted-foreground">{parent.title}</span>
                {children.length > 0 && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/50">{doneCount}/{children.length}</span>
                )}
              </button>
              {onAddChild && (
                <button onClick={() => onAddChild(parent)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-muted hover:text-primary">
                  {addChildLabel ?? "+ נגזר"}
                </button>
              )}
            </div>

            {/* Children */}
            {!isCollapsed && (
              <div className="space-y-0.5 border-r-2 pr-3" style={{ borderColor: col + "40" }}>
                {children.length === 0 ? (
                  <p className="py-1 text-[11px] text-muted-foreground/40">
                    {childType === "monthly" ? "אין יעדים חודשיים" : "אין יעדים שבועיים"}
                  </p>
                ) : (
                  children.map(g => (
                    <GoalRow key={g.id} goal={g} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Orphan goals (no parent from current period) */}
      {orphans.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/50">ללא שיוך</span>
          </div>
          <div className="space-y-0.5 border-r-2 border-border/30 pr-3">
            {orphans.map(g => (
              <GoalRow key={g.id} goal={g} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onBreakdown={onBreakdown} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GoalRow — compact single-line item ─────────────────────────────────────

function GoalRow({ goal, onEdit, onToggle, onDelete, onBreakdown, onAddChild, addChildLabel }: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onToggle: (g: Goal) => void;
  onDelete: (id: string) => void;
  onBreakdown?: (g: Goal) => void;
  onAddChild?: (g: Goal) => void;
  addChildLabel?: string;
}) {
  const isDone = goal.status === "completed";
  const col = goal.color ?? "#94a3b8";

  return (
    <div className={cn("group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40", isDone && "opacity-50")}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(goal)}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
        style={{ borderColor: col, backgroundColor: isDone ? col : "transparent" }}
      >
        {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </button>

      {/* Title */}
      <span className={cn("flex-1 truncate text-sm leading-none", isDone && "text-muted-foreground line-through")}>
        {goal.title}
      </span>

      {/* Progress bar + % */}
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, backgroundColor: col }} />
        </div>
        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">{goal.progress}%</span>
      </div>

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onAddChild && (
          <button onClick={() => onAddChild(goal)} title={addChildLabel}
            className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-primary">
            <Plus className="h-3 w-3" />
          </button>
        )}
        {onBreakdown && (
          <button onClick={() => onBreakdown(goal)} title="פרוס למשימות"
            className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-primary">
            <Target className="h-3 w-3" />
          </button>
        )}
        <button onClick={() => onEdit(goal)}
          className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onDelete(goal.id)}
          className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── EmptyGoals ──────────────────────────────────────────────────────────────

function EmptyGoals({ onAdd }: { onAdd: () => void }) {
  return (
    <button onClick={onAdd}
      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
      <Plus className="h-4 w-4 opacity-50" />
      הוסף יעד
    </button>
  );
}

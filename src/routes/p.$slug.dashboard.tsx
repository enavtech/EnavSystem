import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePlanRealtime } from "@/hooks/usePlanRealtime";
import type { Task } from "@/hooks/usePlanRealtime";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin-session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  ArrowRight,
  Download,
  Activity,
  Loader2,
  Calendar,
  TrendingUp,
  Users,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  MessageCircle,
  ListChecks,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { DEPARTMENT_COLORS, formatDeadline } from "@/lib/plans";

export const Route = createFileRoute("/p/$slug/dashboard")({
  component: DashboardPage,
});

type ActivityRow = {
  id: string;
  action: string;
  entity: string;
  actor_name: string;
  details: { title?: string } | null;
  created_at: string;
};

type WeeklyRow = { action: string; created_at: string };

function DashboardPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { plan, tasks, steps, comments, loading } = usePlanRealtime(slug);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyRow[]>([]);

  useEffect(() => {
    if (!isAdmin()) navigate({ to: "/login" });
  }, [navigate]);

  useEffect(() => {
    if (!plan?.id) return;
    void supabase
      .from("activity_log")
      .select("id,action,entity,actor_name,details,created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setActivity((data ?? []) as ActivityRow[]));

    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    void supabase
      .from("activity_log")
      .select("action,created_at")
      .eq("plan_id", plan.id)
      .gte("created_at", eightWeeksAgo.toISOString())
      .order("created_at", { ascending: true })
      .then(({ data }) => setWeeklyActivity((data ?? []) as WeeklyRow[]));
  }, [plan?.id]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "הושלם").length;
    const prog = tasks.filter((t) => t.status === "בתהליך").length;
    const blocked = tasks.filter((t) => t.status === "מעוכב").length;
    const notStarted = tasks.filter((t) => t.status === "לא התחיל").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter((t) => {
      if (!t.deadline || t.status === "הושלם") return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime();
    }).length;
    const upcoming = tasks
      .filter((t) => t.deadline && t.status !== "הושלם")
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
      .slice(0, 6);

    const byDept = new Map<string, { done: number; total: number }>();
    tasks.forEach((t) => {
      const k = t.department ?? "ללא מחלקה";
      const e = byDept.get(k) ?? { done: 0, total: 0 };
      e.total += 1;
      if (t.status === "הושלם") e.done += 1;
      byDept.set(k, e);
    });
    const deptArr = Array.from(byDept.entries()).map(([name, v]) => ({
      name,
      total: v.total,
      done: v.done,
      open: v.total - v.done,
    }));

    const byPrio = ["דחופה", "גבוהה", "בינונית", "נמוכה"].map((p) => ({
      name: p,
      value: tasks.filter((t) => t.priority === p).length,
    }));

    const totalSteps = Object.values(steps).reduce((a, arr) => a + arr.length, 0);
    const doneSteps = Object.values(steps).reduce(
      (a, arr) => a + arr.filter((s) => s.done).length,
      0
    );
    const totalComments = Object.values(comments).reduce((a, arr) => a + arr.length, 0);

    return {
      total,
      done,
      prog,
      blocked,
      notStarted,
      overdue,
      upcoming,
      deptArr,
      byPrio,
      totalSteps,
      doneSteps,
      totalComments,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks, steps, comments]);

  // Completion timeline (last 14 days from activity log)
  const timeline = useMemo(() => {
    const days: { date: string; label: string; completed: number; created: number }[] =
      [];
    const map = new Map<string, { completed: number; created: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { completed: 0, created: 0 });
      days.push({
        date: key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        completed: 0,
        created: 0,
      });
    }
    activity.forEach((a) => {
      const key = a.created_at.slice(0, 10);
      const e = map.get(key);
      if (!e) return;
      if (a.action === "completed") e.completed += 1;
      if (a.action === "created") e.created += 1;
    });
    return days.map((d) => ({ ...d, ...map.get(d.date)! }));
  }, [activity]);

  const weeklyTrend = useMemo(() => {
    const buckets: { key: string; label: string; completed: number; created: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay() - i * 7);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        completed: 0,
        created: 0,
      });
    }
    weeklyActivity.forEach((a) => {
      const d = new Date(a.created_at);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      const key = d.toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.key === key);
      if (!bucket) return;
      if (a.action === "completed") bucket.completed += 1;
      if (a.action === "created") bucket.created += 1;
    });
    return buckets;
  }, [weeklyActivity]);

  function exportCSV() {
    if (!plan) return;
    const header = [
      "שם משימה",
      "מחלקה",
      "דחיפות",
      "סטטוס",
      "דדליין",
      "הערה",
      "תתי-משימות",
      "תגובות",
    ];
    const rows = tasks.map((t) => {
      const ts = (steps[t.id] ?? [])
        .map((s) => `${s.done ? "✓" : "•"} ${s.content}`)
        .join(" | ");
      const cs = (comments[t.id] ?? [])
        .map((c) => `${c.author_name}: ${c.body.replace(/\n/g, " ")}`)
        .join(" | ");
      return [
        t.title,
        t.department ?? "",
        t.priority,
        t.status,
        t.deadline ?? "",
        (t.note ?? "").replace(/\n/g, " "),
        ts,
        cs,
      ];
    });
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((r) =>
          r
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הורד כ-CSV");
  }

  if (loading || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const PIE_COLORS = ["#dc2626", "#f59e0b", "#3b82f6", "#94a3b8"];

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/p/$slug"
              params={{ slug }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה לתוכנית
            </Link>
          </div>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="ms-2 h-4 w-4" />
            ייצוא CSV
          </Button>
        </div>

        {/* Header */}
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            דשבורד אנליטי
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{plan.name}</h1>
          {plan.subtitle && (
            <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
          )}
        </header>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <KPI label="סה״כ משימות" value={stats.total} />
          <KPI label="הושלמו" value={stats.done} accent="success" />
          <KPI label="בתהליך" value={stats.prog} accent="warning" />
          <KPI label="מעוכב" value={stats.blocked} accent="urgent" />
          <KPI label="באיחור" value={stats.overdue} accent="urgent" />
          <KPI label="% השלמה" value={`${stats.pct}%`} accent="primary" />
        </div>

        {/* Charts */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">התקדמות לפי מחלקה</h3>
              <span className="text-xs text-muted-foreground">{stats.deptArr.length} מחלקות</span>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={stats.deptArr} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="done" stackId="a" fill="oklch(0.55 0.13 160)" name="הושלם" />
                  <Bar dataKey="open" stackId="a" fill="oklch(0.85 0.04 240)" name="פתוח" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">פילוח לפי דחיפות</h3>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={stats.byPrio.filter((x) => x.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {stats.byPrio.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Timeline + Upcoming */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">פעילות ב-14 ימים אחרונים</h3>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="oklch(0.55 0.13 160)"
                    name="הושלמו"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="oklch(0.5 0.13 230)"
                    name="נוצרו"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">דדליינים קרובים</h3>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {stats.upcoming.length === 0 && (
                <p className="text-xs text-muted-foreground">אין דדליינים פעילים</p>
              )}
              {stats.upcoming.map((t) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const d = new Date(t.deadline!);
                d.setHours(0, 0, 0, 0);
                const days = Math.round(
                  (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDeadline(t.deadline)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-medium ${
                        days < 0
                          ? "text-urgent"
                          : days <= 3
                            ? "text-warning-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {days < 0 ? `איחור ${-days}י` : `בעוד ${days}י`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Gantt / Timeline */}
        <Card className="mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">ציר זמן משימות</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.55_0.19_25)]" />
                באיחור
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.7_0.17_70)]" />
                קרוב
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.5_0.13_230)]" />
                בתהליך
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.55_0.13_160)]" />
                הושלם
              </span>
            </div>
          </div>
          <GanttSection tasks={tasks} />
        </Card>

        {/* Weekly trend */}
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">מגמת השלמה שבועית</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyTrend} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completed" fill="oklch(0.55 0.13 160)" name="הושלמו" radius={[3,3,0,0]} />
                <Bar dataKey="created" fill="oklch(0.5 0.13 230)" name="נוצרו" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Engagement + Activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">מעורבות</h3>
            <div className="space-y-3">
              <Stat
                icon={<Users className="h-4 w-4" />}
                label="תתי-משימות"
                value={`${stats.doneSteps} / ${stats.totalSteps}`}
              />
              <Stat
                icon={<Activity className="h-4 w-4" />}
                label="תגובות"
                value={stats.totalComments}
              />
              <Stat
                icon={<Activity className="h-4 w-4" />}
                label="פעולות אחרונות"
                value={activity.length}
              />
            </div>
            {/* Color legend for departments */}
            {stats.deptArr.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  מחלקות
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.deptArr.map((d) => (
                    <span
                      key={d.name}
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        background:
                          (DEPARTMENT_COLORS[d.name] ?? "oklch(0.5 0.03 250)") + "22",
                        color: DEPARTMENT_COLORS[d.name] ?? "oklch(0.4 0.03 250)",
                      }}
                    >
                      {d.name} ({d.total})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">לוג פעילות</h3>
              <div className="flex flex-wrap gap-1">
                {(["all", "created", "completed", "updated", "deleted", "commented"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setActivityFilter(f)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        activityFilter === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {f === "all"
                        ? "הכל"
                        : f === "created"
                          ? "נוצר"
                          : f === "completed"
                            ? "הושלם"
                            : f === "updated"
                              ? "עודכן"
                              : f === "deleted"
                                ? "נמחק"
                                : "תגובה"}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="max-h-[360px] space-y-1.5 overflow-y-auto">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  אין עדיין פעילות. שינויים יופיעו כאן.
                </p>
              )}
              {activity
                .filter(
                  (a) =>
                    activityFilter === "all" ||
                    a.action === activityFilter ||
                    (activityFilter === "commented" && a.action === "commented")
                )
                .map((a) => {
                  const { icon: ActionIcon, bg, fg } = actionStyle(a.action);
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40"
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: bg }}
                      >
                        <ActionIcon
                          className="h-3.5 w-3.5"
                          style={{ color: fg }}
                          strokeWidth={2.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="font-medium">{a.actor_name}</span>{" "}
                          <span className="text-muted-foreground">
                            {actionLabel(a.action)}
                          </span>{" "}
                          {a.details?.title && (
                            <span className="text-foreground">
                              &ldquo;{a.details.title}&rdquo;
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("he-IL")}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case "created":    return "יצר/ה משימה";
    case "completed":  return "סיים/ה משימה";
    case "reopened":   return "פתח/ה מחדש משימה";
    case "updated":    return "עדכן/ה משימה";
    case "deleted":    return "מחק/ה משימה";
    case "commented":  return "הגיב/ה על";
    case "step_added": return "הוסיף/ה תת-משימה";
    case "step_done":  return "סימן/ה תת-משימה";
    default:           return a;
  }
}

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;

function actionStyle(action: string): { icon: IconComponent; bg: string; fg: string } {
  switch (action) {
    case "created":
      return { icon: PlusCircle,    bg: "oklch(0.5 0.13 230 / 0.15)",  fg: "oklch(0.5 0.13 230)" };
    case "completed":
      return { icon: CheckCircle2,  bg: "oklch(0.55 0.13 160 / 0.15)", fg: "oklch(0.45 0.13 160)" };
    case "reopened":
      return { icon: RefreshCw,     bg: "oklch(0.7 0.17 70 / 0.15)",   fg: "oklch(0.6 0.17 70)" };
    case "updated":
      return { icon: ListChecks,    bg: "oklch(0.6 0.1 280 / 0.15)",   fg: "oklch(0.5 0.1 280)" };
    case "deleted":
      return { icon: XCircle,       bg: "oklch(0.55 0.19 25 / 0.15)",  fg: "oklch(0.5 0.19 25)" };
    case "commented":
      return { icon: MessageCircle, bg: "oklch(0.6 0.08 200 / 0.15)",  fg: "oklch(0.5 0.08 200)" };
    default:
      return { icon: Activity,      bg: "oklch(0.5 0.03 250 / 0.15)",  fg: "oklch(0.5 0.03 250)" };
  }
}

// ─── Gantt Chart ────────────────────────────────────────────────────────────

function GanttSection({ tasks }: { tasks: Task[] }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const windowStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return d;
  }, [today]);

  const windowEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 21);
    return d;
  }, [today]);

  const WINDOW_DAYS = 28;

  const visible = useMemo(() => {
    return tasks
      .filter((t) => {
        if (!t.deadline) return false;
        const dl = new Date(t.deadline);
        dl.setHours(0, 0, 0, 0);
        return dl >= windowStart && dl <= windowEnd;
      })
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
      .slice(0, 25);
  }, [tasks, windowStart, windowEnd]);

  if (visible.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        אין משימות עם תאריך יעד ב-28 ימים הקרובים.
      </p>
    );
  }

  function toPct(date: Date): number {
    const diff = (date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    return (diff / WINDOW_DAYS) * 100;
  }

  const todayPct = toPct(today);

  const dayLabels = [0, 7, 14, 21, 28].map((offset) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + offset);
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      pct: (offset / WINDOW_DAYS) * 100,
    };
  });

  return (
    <div className="overflow-x-auto">
      {/* X-axis labels */}
      <div className="flex mb-2 min-w-[500px]">
        <div className="w-[32%] shrink-0" />
        <div className="relative flex-1 h-4">
          {dayLabels.map((l) => (
            <span
              key={l.pct}
              className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${l.pct}%` }}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="relative min-w-[500px]">
        {/* Background grid + today line (spans all rows) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ marginInlineStart: "32%" }}
        >
          {dayLabels.map((l) => (
            <div
              key={l.pct}
              className="absolute inset-y-0 w-px bg-border/40"
              style={{ left: `${l.pct}%` }}
            />
          ))}
          <div
            className="absolute inset-y-0 w-0.5 bg-urgent/70 z-10"
            style={{ left: `${todayPct}%` }}
          />
        </div>

        {visible.map((t) => {
          const deadline = new Date(t.deadline!);
          deadline.setHours(0, 0, 0, 0);
          const created = new Date(t.created_at);
          created.setHours(0, 0, 0, 0);

          const barStartPct = Math.max(0, toPct(created < windowStart ? windowStart : created));
          const barEndPct = Math.min(100, toPct(deadline));
          const barWidthPct = Math.max(0.8, barEndPct - barStartPct);

          const days = Math.round(
            (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const isDone = t.status === "הושלם";
          const barColor = isDone
            ? "oklch(0.55 0.13 160)"
            : days < 0
              ? "oklch(0.55 0.19 25)"
              : days <= 3
                ? "oklch(0.7 0.17 70)"
                : "oklch(0.5 0.13 230)";

          return (
            <div key={t.id} className="mb-1 flex h-7 items-center">
              <div
                className="w-[32%] shrink-0 truncate pe-2 text-[11px] text-muted-foreground"
                dir="rtl"
              >
                {t.title}
              </div>
              <div className="relative flex-1 h-4">
                <div
                  className="absolute top-0 h-full rounded-full opacity-85 transition-all"
                  style={{
                    left: `${barStartPct}%`,
                    width: `${barWidthPct}%`,
                    backgroundColor: barColor,
                  }}
                />
                {/* Deadline dot */}
                <div
                  className="absolute top-0 z-20 h-4 w-1 rounded-full opacity-90"
                  style={{
                    left: `calc(${barEndPct}% - 2px)`,
                    backgroundColor: barColor,
                    filter: "brightness(0.7)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "success" | "warning" | "urgent" | "primary";
}) {
  const color =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning-foreground"
        : accent === "urgent"
          ? "text-urgent"
          : accent === "primary"
            ? "text-primary"
            : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
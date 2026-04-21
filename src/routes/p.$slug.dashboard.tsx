import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { usePlanRealtime } from "@/hooks/usePlanRealtime";
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

function DashboardPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { plan, tasks, steps, comments, loading } = usePlanRealtime(slug);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

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
            <h3 className="mb-3 text-sm font-semibold">פיד פעילות</h3>
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  אין עדיין פעילות. שינויים יופיעו כאן.
                </p>
              )}
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                    {a.actor_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{a.actor_name}</span>{" "}
                      <span className="text-muted-foreground">{actionLabel(a.action)}</span>{" "}
                      {a.details?.title && (
                        <span className="text-foreground">"{a.details.title}"</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("he-IL")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case "created":
      return "יצר/ה משימה";
    case "completed":
      return "סיים/ה משימה";
    case "reopened":
      return "פתח/ה מחדש משימה";
    case "updated":
      return "עדכן/ה משימה";
    case "deleted":
      return "מחק/ה משימה";
    case "commented":
      return "הגיב/ה על";
    case "step_added":
      return "הוסיף/ה תת-משימה";
    case "step_done":
      return "סימן/ה תת-משימה";
    default:
      return a;
  }
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
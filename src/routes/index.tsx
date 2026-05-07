import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import {
  Users,
  TrendingUp,
  CalendarDays,
  Film,
  CheckSquare,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Circle,
  Banknote,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";

export const Route = createFileRoute("/")({
  component: Index,
});

// ── Types ──────────────────────────────────────────────────────────────

interface ContactRow {
  stage: string;
  source: string;
  monthly_fee: string | null;
  client_since: string | null;
  client_status: string | null;
  name: string;
  lead_date: string | null;
  created_at: string;
}

interface KPI {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface ContactStage {
  stage: string;
  count: number;
}

interface MemberTasks {
  name: string;
  open: number;
  done: number;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  contact_name: string | null;
  meeting_type: string;
}

interface ContentStatus {
  status: string;
  count: number;
}

// ── Stage config ───────────────────────────────────────────────────────
const STAGE_ORDER = [
  "ליד חדש",
  "יצירת קשר",
  "פגישת היכרות",
  "הצעת מחיר",
  "משא ומתן",
  "לקוח פעיל",
  "לא רלוונטי",
];

const STAGE_COLORS: Record<string, string> = {
  "ליד חדש":         "bg-slate-400",
  "יצירת קשר":       "bg-blue-400",
  "פגישת היכרות":    "bg-indigo-400",
  "הצעת מחיר":       "bg-violet-400",
  "משא ומתן":        "bg-amber-400",
  "לקוח פעיל":       "bg-emerald-500",
  "לא רלוונטי":      "bg-rose-400",
};

const STAGE_TEXT: Record<string, string> = {
  "ליד חדש":         "text-slate-600",
  "יצירת קשר":       "text-blue-600",
  "פגישת היכרות":    "text-indigo-600",
  "הצעת מחיר":       "text-violet-600",
  "משא ומתן":        "text-amber-600",
  "לקוח פעיל":       "text-emerald-700",
  "לא רלוונטי":      "text-rose-600",
};

// ── Content status config ──────────────────────────────────────────────
const CONTENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "רעיון":    { label: "רעיון",    color: "text-slate-600",   bg: "bg-slate-100"   },
  "תסריט":   { label: "תסריט",   color: "text-blue-600",    bg: "bg-blue-50"     },
  "צילום":    { label: "צילום",    color: "text-violet-600",  bg: "bg-violet-50"   },
  "עריכה":    { label: "עריכה",    color: "text-amber-600",   bg: "bg-amber-50"    },
  "בקרה":    { label: "בקרה",    color: "text-orange-600",  bg: "bg-orange-50"   },
  "הועלה":   { label: "הועלה",   color: "text-emerald-700", bg: "bg-emerald-50"  },
};

// ── Meeting type labels ────────────────────────────────────────────────
const MEETING_TYPE_LABELS: Record<string, string> = {
  "ייעוץ":           "ייעוץ",
  "שיווק":           "שיווק",
  "צילום":           "צילום",
  "מכירה ראשונית":  "מכירה",
  "אסטרטגיה":       "אסטרטגיה",
  "תוכן":            "תוכן",
  "שבועית":          "שבועית",
};

// ── Recharts Tooltip ───────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
function Index() {
  const [loading, setLoading] = useState(true);

  // KPI data
  const [totalLeads, setTotalLeads]             = useState(0);
  const [activeClients, setActiveClients]       = useState(0);
  const [conversionRate, setConversionRate]     = useState(0);
  const [meetingsThisWeek, setMeetingsThisWeek] = useState(0);
  const [contentInProgress, setContentInProgress] = useState(0);
  const [openTasks, setOpenTasks]               = useState(0);
  const [overdueTasks, setOverdueTasks]         = useState(0);
  const [closedDeals, setClosedDeals]           = useState(0);
  const [totalMRR, setTotalMRR]               = useState(0);
  const [leadsThisMonth, setLeadsThisMonth]   = useState(0);
  const [leadsLastMonth, setLeadsLastMonth]   = useState(0);
  const [convertedThisMonth, setConvertedThisMonth] = useState(0);
  const [mrrByClient, setMrrByClient]         = useState<{ name: string; fee: number }[]>([]);

  // Chart data
  const [stageData, setStageData]             = useState<ContactStage[]>([]);
  const [memberTasks, setMemberTasks]         = useState<MemberTasks[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [contentByStatus, setContentByStatus] = useState<ContentStatus[]>([]);
  const [sourceData, setSourceData]           = useState<{ source: string; count: number }[]>([]);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    const [
      contactsRes,
      tasksRes,
      meetingsRes,
      contentRes,
      internalTasksRes,
      teamRes,
    ] = await Promise.all([
      supabase.from("contacts").select("stage, source, monthly_fee, client_since, client_status, name, lead_date, created_at"),
      supabase.from("tasks").select("status, deadline"),
      supabase
        .from("meetings")
        .select("id, title, meeting_date, meeting_time, type, contact_id")
        .gte("meeting_date", today)
        .lte("meeting_date", weekEnd)
        .eq("status", "מתוכנן")
        .order("meeting_date", { ascending: true })
        .limit(5),
      supabase.from("content_items").select("status, due_date"),
      supabase.from("internal_tasks").select("assignee_id, status"),
      supabase.from("team_members").select("id, name, color"),
    ]);

    // ── Contacts ──────────────────────────────────────────────────────
    if (contactsRes.data) {
      const contacts = contactsRes.data as unknown as ContactRow[];
      const now = new Date();
      const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

      const total = contacts.length;
      const active = contacts.filter((c) => c.stage === "לקוח פעיל").length;
      const notRelevant = contacts.filter((c) => c.stage === "לא רלוונטי").length;
      const pipeline = total - notRelevant;

      setTotalLeads(total);
      setActiveClients(active);
      setClosedDeals(active);
      setConversionRate(pipeline > 0 ? Math.round((active / pipeline) * 100) : 0);

      // MRR — parse monthly_fee from active non-archived clients
      const parseFee = (fee: string | null | undefined) =>
        fee ? parseFloat(String(fee).replace(/[^\d.]/g, "")) || 0 : 0;
      const activeClients = contacts.filter(
        (c) => c.stage === "לקוח פעיל" && c.client_status !== "archived"
      );
      const mrr = activeClients.reduce((sum, c) => sum + parseFee(c.monthly_fee), 0);
      setTotalMRR(mrr);
      setMrrByClient(
        activeClients
          .map((c) => ({ name: c.name, fee: parseFee(c.monthly_fee) }))
          .filter((c) => c.fee > 0)
          .sort((a, b) => b.fee - a.fee)
          .slice(0, 8)
      );

      // Monthly lead analytics
      const leads = contacts.filter((c) => c.stage !== "לקוח פעיל");
      const leadsThisMo = leads.filter((c) => {
        const d = c.lead_date ?? c.created_at ?? "";
        return d.startsWith(thisMonthStr);
      }).length;
      const leadsLastMo = leads.filter((c) => {
        const d = c.lead_date ?? c.created_at ?? "";
        return d.startsWith(prevMonthStr);
      }).length;
      const convertedThisMo = activeClients.filter((c) => {
        const d = c.client_since ?? "";
        return d.startsWith(thisMonthStr);
      }).length;
      setLeadsThisMonth(leadsThisMo);
      setLeadsLastMonth(leadsLastMo);
      setConvertedThisMonth(convertedThisMo);

      // Stage distribution
      const stageCounts: Record<string, number> = {};
      for (const c of contacts) {
        stageCounts[c.stage] = (stageCounts[c.stage] ?? 0) + 1;
      }
      setStageData(
        STAGE_ORDER.map((s) => ({ stage: s, count: stageCounts[s] ?? 0 }))
      );

      // Source distribution
      const sourceCounts: Record<string, number> = {};
      for (const c of contacts) {
        const src = c.source || "אחר";
        sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
      }
      setSourceData(
        Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([source, count]) => ({ source, count }))
      );
    }

    // ── Tasks ─────────────────────────────────────────────────────────
    if (tasksRes.data) {
      const tasks = tasksRes.data;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const open = tasks.filter((t) => t.status !== "הושלם" && t.status !== "ארכיון").length;
      const overdue = tasks.filter((t) => {
        if (t.status === "הושלם" || t.status === "ארכיון") return false;
        if (!t.deadline) return false;
        return new Date(t.deadline) < todayDate;
      }).length;
      setOpenTasks(open);
      setOverdueTasks(overdue);
    }

    // ── Meetings ──────────────────────────────────────────────────────
    if (meetingsRes.data) {
      setMeetingsThisWeek(meetingsRes.data.length);
      // Fetch contact names
      const contactIds = meetingsRes.data
        .map((m) => m.contact_id)
        .filter(Boolean) as string[];
      let contactNames: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: cData } = await supabase
          .from("contacts")
          .select("id, name")
          .in("id", contactIds);
        if (cData) {
          contactNames = Object.fromEntries(cData.map((c) => [c.id, c.name]));
        }
      }
      setUpcomingMeetings(
        meetingsRes.data.map((m) => ({
          id: m.id,
          title: m.title,
          meeting_date: m.meeting_date,
          meeting_time: m.meeting_time,
          contact_name: m.contact_id ? (contactNames[m.contact_id] ?? null) : null,
          meeting_type: m.type,
        }))
      );
    }

    // ── Content ───────────────────────────────────────────────────────
    if (contentRes.data) {
      const content = contentRes.data;
      const inProgress = content.filter(
        (c) => c.status !== "הועלה"
      ).length;
      setContentInProgress(inProgress);

      const statusCounts: Record<string, number> = {};
      for (const c of content) {
        statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
      }
      setContentByStatus(
        Object.keys(CONTENT_STATUS_CONFIG)
          .filter((s) => statusCounts[s] !== undefined)
          .map((s) => ({ status: s, count: statusCounts[s] ?? 0 }))
      );
    }

    // ── Internal tasks per team member ────────────────────────────────
    if (internalTasksRes.data && teamRes.data) {
      const memberById: Record<string, string> = {};
      for (const m of teamRes.data) {
        memberById[m.id] = m.name;
      }
      const tasksByMember: Record<string, { open: number; done: number }> = {};
      for (const t of internalTasksRes.data) {
        if (!t.assignee_id) continue;
        const name = memberById[t.assignee_id];
        if (!name) continue;
        if (!tasksByMember[name]) tasksByMember[name] = { open: 0, done: 0 };
        if (t.status === "הושלם") {
          tasksByMember[name].done++;
        } else {
          tasksByMember[name].open++;
        }
      }
      setMemberTasks(
        Object.entries(tasksByMember)
          .sort((a, b) => (b[1].open + b[1].done) - (a[1].open + a[1].done))
          .slice(0, 8)
          .map(([name, counts]) => ({ name, ...counts }))
      );
    }

    setLoading(false);
  }

  // ── KPI cards config ───────────────────────────────────────────────
  const kpis: KPI[] = [
    {
      label: "לידים בצינור",
      value: totalLeads,
      sub: `${activeClients} לקוח פעיל`,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/8",
    },
    {
      label: "MRR",
      value: totalMRR > 0 ? `₪${totalMRR.toLocaleString("he-IL")}` : "₪0",
      sub: convertedThisMonth > 0 ? `+${convertedThisMonth} לקוחות החודש` : `${activeClients} לקוחות פעילים`,
      icon: Banknote,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "שיעור המרה",
      value: `${conversionRate}%`,
      sub: `${closedDeals} לקוחות סגורים`,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "פגישות השבוע",
      value: meetingsThisWeek,
      sub: "7 הימים הקרובים",
      icon: CalendarDays,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "תוכן בייצור",
      value: contentInProgress,
      sub: "פריטים פתוחים",
      icon: Film,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "משימות פתוחות",
      value: openTasks,
      sub: overdueTasks > 0 ? `${overdueTasks} מאחרות` : "הכל בזמן",
      icon: CheckSquare,
      color: overdueTasks > 0 ? "text-rose-600" : "text-foreground",
      bg: overdueTasks > 0 ? "bg-rose-50" : "bg-muted",
    },
  ];

  // ── Funnel max for scaling bars ────────────────────────────────────
  const funnelMax = stageData.reduce((m, s) => Math.max(m, s.count), 1);

  // ── Recharts bar colors ────────────────────────────────────────────
  const CHART_COLORS = ["#4f8ef7", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

  // ── Date formatter ─────────────────────────────────────────────────
  function formatMeetingDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    if (d.toDateString() === today.toDateString()) return "היום";
    if (d.toDateString() === tomorrow.toDateString()) return "מחר";
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  }

  return (
    <AppShell>
      <div className="min-h-screen px-7 py-6" style={{ direction: "rtl" }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            סקירה כללית של כל המערכות התפעוליות
          </p>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── KPI strip ────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", kpi.bg)}>
                      <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                    </div>
                    {kpi.label === "משימות פתוחות" && overdueTasks > 0 && (
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                    <div className="mt-0.5 text-xs font-medium text-muted-foreground">{kpi.label}</div>
                    {kpi.sub && (
                      <div className={cn(
                        "mt-1 text-[11px]",
                        kpi.label === "משימות פתוחות" && overdueTasks > 0
                          ? "text-rose-500 font-semibold"
                          : "text-muted-foreground/70"
                      )}>
                        {kpi.sub}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Row 2: Pipeline funnel + Upcoming meetings ──── */}
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Pipeline funnel */}
              <div className="glass rounded-2xl p-5 lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">מרכז בקרה ללידים</h2>
                  <span className="text-xs text-muted-foreground">פילוח לפי שלב</span>
                </div>
                <div className="space-y-2.5">
                  {STAGE_ORDER.map((stage) => {
                    const item = stageData.find((s) => s.stage === stage);
                    const count = item?.count ?? 0;
                    const pct = funnelMax > 0 ? Math.max((count / funnelMax) * 100, count > 0 ? 4 : 0) : 0;
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">{stage}</div>
                        <div className="flex-1 overflow-hidden rounded-full bg-muted/60 h-5">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              STAGE_COLORS[stage] ?? "bg-slate-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className={cn(
                          "w-7 shrink-0 text-center text-xs font-semibold",
                          STAGE_TEXT[stage] ?? "text-foreground"
                        )}>
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Source breakdown */}
                {sourceData.length > 0 && (
                  <div className="mt-5 border-t border-border/50 pt-4">
                    <div className="mb-3 text-xs font-semibold text-muted-foreground">מקורות לידים</div>
                    <div className="flex flex-wrap gap-2">
                      {sourceData.map(({ source, count }) => (
                        <div key={source} className="glass-subtle flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
                          <Circle className="h-2 w-2 fill-primary text-primary" />
                          <span className="font-medium text-foreground">{source}</span>
                          <span className="text-muted-foreground">({count})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Upcoming meetings */}
              <div className="glass rounded-2xl p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">פגישות קרובות</h2>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                {upcomingMeetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarDays className="mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">אין פגישות השבוע</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingMeetings.map((m) => (
                      <div key={m.id} className="glass-subtle flex items-center gap-3 rounded-xl p-3">
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-foreground">{m.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{formatMeetingDate(m.meeting_date)}</span>
                            {m.meeting_time && (
                              <>
                                <span className="text-[11px] text-muted-foreground/50">·</span>
                                <span className="text-[11px] text-muted-foreground">{m.meeting_time.slice(0, 5)}</span>
                              </>
                            )}
                          </div>
                          {m.contact_name && (
                            <div className="mt-0.5 text-[11px] text-primary/80">{m.contact_name}</div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                            {MEETING_TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3: Operations + Deals + Content ──────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Operations — tasks per team member */}
              <div className="glass rounded-2xl p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">מרכז בקרה תפעולי</h2>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">משימות לפי חבר צוות</p>

                {/* Summary row */}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "פתוחות", value: openTasks,   color: "text-primary" },
                    { label: "מאחרות", value: overdueTasks, color: overdueTasks > 0 ? "text-rose-600" : "text-muted-foreground" },
                  ].map((s) => (
                    <div key={s.label} className="glass-subtle rounded-xl p-2.5 text-center">
                      <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                  <div className="glass-subtle rounded-xl p-2.5 text-center">
                    <div className="text-xl font-bold text-emerald-600">
                      {memberTasks.reduce((s, m) => s + m.done, 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">הושלמו</div>
                  </div>
                </div>

                {memberTasks.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={memberTasks} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="open" name="פתוחות" stackId="a" radius={[0, 0, 4, 4]}>
                        {memberTasks.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                      <Bar dataKey="done" name="הושלמו" stackId="a" radius={[4, 4, 0, 0]}>
                        {memberTasks.map((_, i) => (
                          <Cell key={i} fill={`${CHART_COLORS[i % CHART_COLORS.length]}55`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    אין נתוני משימות
                  </div>
                )}
              </div>

              {/* Deals / conversion */}
              <div className="glass rounded-2xl p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">מרכז בקרה עסקאות</h2>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">ניתוח המרה לפי שלב</p>

                {/* Big conversion number */}
                <div className="mb-4 rounded-2xl bg-primary/6 p-4 text-center">
                  <div className="text-4xl font-bold gradient-text">{conversionRate}%</div>
                  <div className="mt-1 text-xs text-muted-foreground">שיעור המרה כולל</div>
                </div>

                {/* Stage breakdown for funnel stages only */}
                <div className="space-y-2">
                  {stageData
                    .filter((s) => s.stage !== "לא רלוונטי")
                    .map((s) => {
                      const pct = totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0;
                      return (
                        <div key={s.stage} className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full shrink-0", STAGE_COLORS[s.stage])} />
                          <span className="flex-1 text-xs text-muted-foreground">{s.stage}</span>
                          <span className="text-xs font-medium text-foreground">{s.count}</span>
                          <div className="w-16 overflow-hidden rounded-full bg-muted/60 h-1.5">
                            <div
                              className={cn("h-full rounded-full", STAGE_COLORS[s.stage])}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                </div>

                {/* Lost leads */}
                {stageData.find((s) => s.stage === "לא רלוונטי")?.count ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    <span className="text-xs text-rose-600">
                      {stageData.find((s) => s.stage === "לא רלוונטי")?.count} לידים לא רלוונטיים
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Content production status */}
              <div className="glass rounded-2xl p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">תוכן פרודקשן</h2>
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">סטטוס לפי שלב ייצור</p>

                <div className="space-y-2.5">
                  {contentByStatus.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                      אין פריטי תוכן
                    </div>
                  ) : (
                    contentByStatus.map(({ status, count }) => {
                      const cfg = CONTENT_STATUS_CONFIG[status];
                      const total = contentByStatus.reduce((s, c) => s + c.count, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className={cn(
                            "w-14 shrink-0 rounded-lg px-2 py-0.5 text-center text-[11px] font-medium",
                            cfg?.bg ?? "bg-muted",
                            cfg?.color ?? "text-foreground"
                          )}>
                            {status}
                          </span>
                          <div className="flex-1 overflow-hidden rounded-full bg-muted/60 h-3">
                            <div
                              className="h-full rounded-full progress-gradient transition-all duration-500"
                              style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right text-xs font-semibold text-foreground">{count}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Total */}
                {contentByStatus.length > 0 && (
                  <div className="mt-4 border-t border-border/50 pt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">סה"כ פריטים</span>
                    <span className="text-sm font-bold text-foreground">
                      {contentByStatus.reduce((s, c) => s + c.count, 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 4: Revenue + Monthly analytics ───────────── */}
            <div className="grid gap-4 lg:grid-cols-2">

              {/* MRR breakdown */}
              <div className="glass rounded-2xl p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">הכנסות חודשיות (MRR)</h2>
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">סה"כ מלקוחות פעילים</p>

                {/* Big MRR number */}
                <div className="mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    ₪{totalMRR.toLocaleString("he-IL")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">הכנסה חודשית חוזרת</div>
                </div>

                {/* Per-client breakdown */}
                {mrrByClient.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    אין נתוני עלות חודשית ללקוחות
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mrrByClient.map(({ name, fee }) => {
                      const pct = totalMRR > 0 ? Math.round((fee / totalMRR) * 100) : 0;
                      return (
                        <div key={name} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">{name}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-muted/60 h-2">
                            <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                              style={{ width: `${Math.max(pct, fee > 0 ? 3 : 0)}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-left text-xs font-semibold text-foreground tabular-nums">
                            ₪{fee.toLocaleString("he-IL")}
                          </span>
                          <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                    {mrrByClient.length > 0 && (
                      <div className="mt-3 border-t border-border/50 pt-2.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">ממוצע ללקוח</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          ₪{activeClients > 0 ? Math.round(totalMRR / activeClients).toLocaleString("he-IL") : 0}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Monthly performance */}
              <div className="glass rounded-2xl p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">ביצועים חודשיים</h2>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" })} vs חודש קודם
                </p>

                {/* Lead comparison */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {(() => {
                    const diff = leadsThisMonth - leadsLastMonth;
                    const DiffIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
                    const diffColor = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-500" : "text-muted-foreground";
                    return (
                      <>
                        <div className="glass-subtle rounded-xl p-3 text-center">
                          <div className="text-2xl font-bold text-foreground tabular-nums">{leadsThisMonth}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">לידים החודש</div>
                        </div>
                        <div className="glass-subtle rounded-xl p-3 text-center">
                          <div className="text-2xl font-bold text-muted-foreground/60 tabular-nums">{leadsLastMonth}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">חודש קודם</div>
                        </div>
                        <div className="glass-subtle rounded-xl p-3 text-center">
                          <div className={cn("flex items-center justify-center gap-0.5 text-2xl font-bold tabular-nums", diffColor)}>
                            <DiffIcon className="h-4 w-4" />
                            {Math.abs(diff)}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">שינוי</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Conversion this month */}
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground tabular-nums">{convertedThisMonth}</div>
                    <div className="text-xs text-muted-foreground">לקוחות חדשים הצטרפו החודש</div>
                  </div>
                  {convertedThisMonth > 0 && (
                    <div className="ms-auto text-xs font-semibold text-emerald-600">
                      +₪{(convertedThisMonth * (activeClients > 0 ? Math.round(totalMRR / activeClients) : 0)).toLocaleString("he-IL")} MRR
                    </div>
                  )}
                </div>

                {/* Conversion rate */}
                <div className="rounded-xl border border-border/50 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">שיעור המרה כולל</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/60">
                      <div className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${conversionRate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{conversionRate}%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

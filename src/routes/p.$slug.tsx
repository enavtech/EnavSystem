import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { usePlanRealtime } from "@/hooks/usePlanRealtime";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin-session";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_ORDER,
  PRIORITIES,
  DEPARTMENTS,
  getAuthorName,
  setAuthorName,
} from "@/lib/plans";
import {
  Share2,
  Plus,
  ArrowRight,
  Check,
  Filter,
  ArrowUpDown,
  Users,
  Maximize2,
  X,
  Mail,
  BarChart3,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/p/$slug")({
  component: PlanPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">התוכנית לא נמצאה</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          חזרה לרשימה
        </Link>
      </div>
    </div>
  ),
});

function PlanPage() {
  const { slug } = Route.useParams();
  const { plan, tasks, steps, comments, loading } = usePlanRealtime(slug);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin()) navigate({ to: "/login" });
  }, [navigate]);

  const [filter, setFilter] = useState<"all" | "דחופה" | "גבוהה" | "בינונית" | "done">("all");
  const [sort, setSort] = useState<"priority" | "deadline">("priority");
  const [showAdd, setShowAdd] = useState(false);
  const [showName, setShowName] = useState(false);
  const [authorInput, setAuthorInput] = useState("");
  const [presentMode, setPresentMode] = useState(false);
  const [clientEmail, setClientEmail] = useState("");

  const [nt, setNt] = useState({
    title: "",
    department: DEPARTMENTS[0] as string,
    priority: "בינונית" as string,
    deadline: "",
    note: "",
  });

  useEffect(() => {
    setAuthorInput(getAuthorName());
  }, []);

  useEffect(() => {
    if (plan) setClientEmail((plan as any).client_email ?? "");
  }, [plan?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && presentMode) setPresentMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [presentMode]);

  const filteredTasks = useMemo(() => {
    let arr = tasks;
    if (filter === "done") arr = arr.filter((t) => t.status === "הושלם");
    else if (filter !== "all") arr = arr.filter((t) => t.priority === filter);
    return [...arr].sort((a, b) => {
      if (sort === "priority") {
        const pd = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        if (pd !== 0) return pd;
        return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      }
      const dd = (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      if (dd !== 0) return dd;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    });
  }, [tasks, filter, sort]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "הושלם").length;
    const prog = tasks.filter((t) => t.status === "בתהליך").length;
    const urgent = tasks.filter((t) => t.priority === "דחופה" && t.status !== "הושלם").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, prog, urgent, pct };
  }, [tasks]);

  async function copyShareLink() {
    if (!plan) return;
    const url = `${window.location.origin}/c/${plan.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הלינק ללקוח הועתק");
    } catch {
      toast.error("לא הצלחתי להעתיק");
    }
  }

  async function saveClientEmail() {
    if (!plan) return;
    await supabase.from("plans").update({ client_email: clientEmail.trim() || null } as any).eq("id", plan.id);
    if (clientEmail.trim()) toast.success("המייל נשמר");
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !nt.title.trim()) return;
    const pos = tasks.length;
    const { error } = await supabase.from("tasks").insert({
      plan_id: plan.id,
      title: nt.title.trim(),
      department: nt.department,
      priority: nt.priority,
      deadline: nt.deadline || null,
      note: nt.note.trim() || null,
      position: pos,
    });
    if (error) { toast.error("שגיאה ביצירה"); return; }
    setNt({ title: "", department: DEPARTMENTS[0], priority: "בינונית", deadline: "", note: "" });
    setShowAdd(false);
    toast.success("המשימה נוצרה");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        טוען…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">התוכנית לא נמצאה</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">חזרה לרשימה</Link>
        </div>
      </div>
    );
  }

  const statusColors = (plan as any).status_colors as Record<string, string> | null ?? null;
  const accentColor = plan.accent_color ?? "#2D4A6B";

  /* ── Presentation mode ── */
  if (presentMode) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster position="top-center" dir="rtl" />
        <div className="fixed left-4 top-4 z-50">
          <Button size="sm" variant="outline" onClick={() => setPresentMode(false)}>
            <X className="ms-2 h-4 w-4" />
            יציאה
          </Button>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <header className="mb-10 text-center">
            <div className="mx-auto mb-4 h-1 max-w-xs rounded-full" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)` }} />
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{plan.name}</h1>
            {plan.subtitle && <p className="mt-2 text-lg text-muted-foreground">{plan.subtitle}</p>}
            <div className="mt-8 grid grid-cols-4 gap-4">
              <Stat label="סה״כ" value={stats.total} />
              <Stat label="הושלמו" value={stats.done} color="text-success" />
              <Stat label="בתהליך" value={stats.prog} color="text-warning-foreground" />
              <Stat label="% השלמה" value={`${stats.pct}%`} />
            </div>
            <div className="mx-auto mt-4 max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${stats.pct}%` }} />
              </div>
            </div>
          </header>
          <div className="space-y-2">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                steps={steps[t.id] ?? []}
                comments={comments[t.id] ?? []}
                statusColors={statusColors}
                readOnly
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal admin view ── */
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-4 w-4" />
              כל התוכניות
            </Link>
            <Link
              to="/p/$slug/dashboard"
              params={{ slug: plan.slug }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              דשבורד
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowName(!showName)}>
              <Users className="ms-2 h-3.5 w-3.5" />
              {getAuthorName()}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPresentMode(true)} title="מצב הצגה">
              <Maximize2 className="ms-2 h-3.5 w-3.5" />
              הצגה
            </Button>
            <Button size="sm" onClick={copyShareLink}>
              <Share2 className="ms-2 h-3.5 w-3.5" />
              שתף ללקוח
            </Button>
          </div>
        </div>

        {showName && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <span className="text-sm text-muted-foreground">השם שלך לתגובות:</span>
            <Input
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              className="h-8 max-w-[180px]"
              placeholder="השם שלך"
            />
            <Button size="sm" onClick={() => { setAuthorName(authorInput); setShowName(false); toast.success("נשמר"); }}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Header */}
        <header className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-3 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${accentColor}, oklch(0.6 0.13 220))` }} />
          <h1 className="text-2xl font-bold text-foreground">{plan.name}</h1>
          {plan.subtitle && <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="סה״כ" value={stats.total} />
            <Stat label="הושלמו" value={stats.done} color="text-success" />
            <Stat label="בתהליך" value={stats.prog} color="text-warning-foreground" />
            <Stat label="דחופות" value={stats.urgent} color="text-urgent" />
            <Stat label="% השלמה" value={`${stats.pct}%`} />
          </div>

          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${stats.pct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{stats.done} מתוך {stats.total} הושלמו</div>
          </div>

          {/* Client email for reminders */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              onBlur={saveClientEmail}
              placeholder="מייל הלקוח לתזכורות (אופציונלי)"
              className="h-7 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
              dir="ltr"
            />
          </div>
        </header>

        {/* Filters & sort */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "דחופה", "גבוהה", "בינונית", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              {f === "all" ? "הכל" : f === "done" ? "הושלמו" : f}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setSort("priority")}
              className={cn("rounded px-2 py-1 text-[11px]", sort === "priority" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              דחיפות
            </button>
            <button
              onClick={() => setSort("deadline")}
              className={cn("rounded px-2 py-1 text-[11px]", sort === "deadline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              יעד סופי
            </button>
          </div>
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {filteredTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              steps={steps[t.id] ?? []}
              comments={comments[t.id] ?? []}
              isAdminView={true}
              planId={plan.id}
              statusColors={statusColors}
            />
          ))}
          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              אין משימות בתצוגה זו
            </div>
          )}
        </div>

        {/* Add new task */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 p-3 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-card"
          >
            <Plus className="h-4 w-4" />
            משימה חדשה
          </button>
        ) : (
          <form
            onSubmit={createTask}
            className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-card p-4 shadow-[var(--shadow-elevated)]"
          >
            <Input
              autoFocus
              placeholder="כותרת המשימה"
              value={nt.title}
              onChange={(e) => setNt({ ...nt, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Select value={nt.department} onValueChange={(v) => setNt({ ...nt, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={nt.priority} onValueChange={(v) => setNt({ ...nt, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={nt.deadline} onChange={(e) => setNt({ ...nt, deadline: e.target.value })} dir="ltr" />
            </div>
            <Textarea
              placeholder="הערה (אופציונלי)"
              value={nt.note}
              onChange={(e) => setNt({ ...nt, note: e.target.value })}
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button type="submit">צור משימה</Button>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>ביטול</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-semibold", color ?? "text-foreground")}>{value}</div>
    </div>
  );
}

void PRIORITY_ORDER;

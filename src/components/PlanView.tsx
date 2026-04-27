import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Plan, Task, TaskStep, Comment } from "@/hooks/usePlanRealtime";
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
  STATUSES,
  getAuthorName,
  setAuthorName,
  DEFAULT_STATUS_COLORS,
  getStatusColor,
} from "@/lib/plans";
import {
  Share2,
  Plus,
  ArrowRight,
  Check,
  Filter,
  ArrowUpDown,
  Users,
  BarChart3,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Props = {
  plan: Plan;
  tasks: Task[];
  steps: Record<string, TaskStep[]>;
  comments: Record<string, Comment[]>;
  /** When true, shows admin chrome (back link, dashboard link, copy admin/share links). */
  isAdmin: boolean;
  /** Token-based public URL to share with clients. */
  shareUrl: string;
};

export function PlanView({ plan, tasks, steps, comments, isAdmin, shareUrl }: Props) {
  const [filter, setFilter] = useState<"all" | "דחופה" | "גבוהה" | "בינונית" | "done">(
    "all"
  );
  const [sort, setSort] = useState<"priority" | "deadline">("priority");
  const [showAdd, setShowAdd] = useState(false);
  const [showName, setShowName] = useState(false);
  const [authorInput, setAuthorInput] = useState("");
  const [showColors, setShowColors] = useState(false);

  // Local working copy of status colors (only used while admin edits in the dialog).
  const planStatusColors =
    (plan.status_colors as Record<string, string> | null | undefined) ?? null;
  const accentColor = plan.accent_color ?? "#2D4A6B";

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
    const urgent = tasks.filter(
      (t) => t.priority === "דחופה" && t.status !== "הושלם"
    ).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, prog, urgent, pct };
  }, [tasks]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("הלינק ללקוח הועתק");
    } catch {
      toast.error("לא הצלחתי להעתיק. הלינק: " + shareUrl);
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!nt.title.trim()) return;
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
    if (error) {
      toast.error("שגיאה ביצירה");
      return;
    }
    await supabase.from("activity_log").insert({
      plan_id: plan.id,
      action: "created",
      entity: "task",
      actor_name: getAuthorName(),
      details: { title: nt.title.trim() },
    });
    setNt({
      title: "",
      department: DEPARTMENTS[0],
      priority: "בינונית",
      deadline: "",
      note: "",
    });
    setShowAdd(false);
    toast.success("המשימה נוצרה");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
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
          ) : (
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              תוכנית עבודה
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowName(!showName)}
            >
              <Users className="ms-2 h-3.5 w-3.5" />
              {getAuthorName()}
            </Button>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowColors(true)}
                >
                  <Palette className="ms-2 h-3.5 w-3.5" />
                  צבעים
                </Button>
                <Button size="sm" onClick={copyShareLink}>
                  <Share2 className="ms-2 h-3.5 w-3.5" />
                  שתף ללקוח
                </Button>
              </>
            )}
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
            <Button
              size="sm"
              onClick={() => {
                setAuthorName(authorInput);
                setShowName(false);
                toast.success("נשמר");
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Header */}
        <header className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div
            className="h-24 bg-gradient-to-br from-primary/12 via-card to-accent/30"
          >
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, ${plan.accent_color ?? "#2D4A6B"}, oklch(0.6 0.13 220))`,
              }}
            />
          </div>
          <div className="-mt-12 px-5 pb-5">
            <h1 className="text-2xl font-bold text-foreground">{plan.name}</h1>
            {plan.subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="סה״כ" value={stats.total} />
              <Stat label="הושלמו" value={stats.done} color="text-success" />
              <Stat label="בתהליך" value={stats.prog} color="text-warning-foreground" />
              <Stat label="דחופות" value={stats.urgent} color="text-urgent" />
              <Stat label="% השלמה" value={`${stats.pct}%`} />
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${stats.pct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {stats.done} מתוך {stats.total} הושלמו
              </div>
            </div>
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
              className={cn(
                "rounded px-2 py-1 text-[11px]",
                sort === "priority"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              דחיפות
            </button>
            <button
              onClick={() => setSort("deadline")}
              className={cn(
                "rounded px-2 py-1 text-[11px]",
                sort === "deadline"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
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
              isAdminView={isAdmin}
              planId={plan.id}
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
              <Select
                value={nt.department}
                onValueChange={(v) => setNt({ ...nt, department: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={nt.priority}
                onValueChange={(v) => setNt({ ...nt, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={nt.deadline}
                onChange={(e) => setNt({ ...nt, deadline: e.target.value })}
                dir="ltr"
              />
            </div>
            <Textarea
              placeholder="הערה (אופציונלי)"
              value={nt.note}
              onChange={(e) => setNt({ ...nt, note: e.target.value })}
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button type="submit">צור משימה</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdd(false)}
              >
                ביטול
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-xl font-semibold", color ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
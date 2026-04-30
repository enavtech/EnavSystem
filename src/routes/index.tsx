import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  generateSlug,
  parseSheetRows,
  type ParsedPlan,
  PRIORITY_ORDER,
  calcHealthScore,
  healthScoreBadge,
  healthScoreLabel,
} from "@/lib/plans";
import {
  Plus,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Loader2,
  Share2,
  LogOut,
  Search,
  Archive,
  ChevronRight,
  Users,
  LayoutTemplate,
  BookCopy,
  Target,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { isAdmin, clearAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  share_token: string;
  archived: boolean;
  is_template: boolean;
  updated_at: string;
  accent_color: string | null;
};

type PlanStats = Record<
  string,
  { total: number; done: number; urgent: number; overdue: number }
>;

function Index() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [templates, setTemplates] = useState<PlanRow[]>([]);
  const [stats, setStats] = useState<PlanStats>({});
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedPlan | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewSubtitle, setPreviewSubtitle] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [templateDialog, setTemplateDialog] = useState<PlanRow | null>(null);
  const [fromTemplateName, setFromTemplateName] = useState("");
  const [fromTemplateCreating, setFromTemplateCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAdmin()) {
      navigate({ to: "/login" });
      return;
    }
    setAuthed(true);
  }, [navigate]);

  useEffect(() => {
    if (!authed) return;
    void loadPlans();
  }, [authed]);

  async function loadPlans() {
    const { data: planRows } = await supabase
      .from("plans")
      .select("id,slug,name,subtitle,share_token,archived,updated_at,accent_color,is_template")
      .order("updated_at", { ascending: false });
    const list = (planRows ?? []) as PlanRow[];
    const realPlans = list.filter((p) => !p.is_template);
    const templatePlans = list.filter((p) => p.is_template);
    setPlans(realPlans);
    setTemplates(templatePlans);

    const ids = realPlans.map((p) => p.id);
    if (ids.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("plan_id,status,priority,deadline")
        .in("plan_id", ids);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const map: PlanStats = {};
      realPlans.forEach((p) => {
        map[p.id] = { total: 0, done: 0, urgent: 0, overdue: 0 };
      });
      (tasks ?? []).forEach((t) => {
        const s = map[t.plan_id];
        if (!s) return;
        s.total += 1;
        if (t.status === "הושלם") s.done += 1;
        if (t.priority === "דחופה" && t.status !== "הושלם") s.urgent += 1;
        if (t.deadline && t.status !== "הושלם") {
          const d = new Date(t.deadline);
          d.setHours(0, 0, 0, 0);
          if (d.getTime() < today.getTime()) s.overdue += 1;
        }
      });
      setStats(map);
    }
  }

  const totals = useMemo(() => {
    let t = 0, d = 0, u = 0, o = 0;
    Object.values(stats).forEach((s) => {
      t += s.total; d += s.done; u += s.urgent; o += s.overdue;
    });
    return { t, d, u, o, pct: t ? Math.round((d / t) * 100) : 0 };
  }, [stats]);

  const visiblePlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (p.archived !== showArchived) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.subtitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [plans, search, showArchived]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("חובה להזין שם"); return; }
    setCreating(true);
    const slug = generateSlug(name);
    const { error } = await supabase
      .from("plans")
      .insert({ slug, name: name.trim(), subtitle: subtitle.trim() || null });
    setCreating(false);
    if (error) { toast.error("שגיאה ביצירה: " + error.message); return; }
    navigate({ to: "/p/$slug", params: { slug } });
  }

  async function copyShareLink(token: string) {
    const url = `${window.location.origin}/c/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הלינק ללקוח הועתק");
    } catch {
      toast.error("לא הצלחתי להעתיק");
    }
  }

  async function toggleArchive(p: PlanRow) {
    const { error } = await supabase.from("plans").update({ archived: !p.archived }).eq("id", p.id);
    if (error) toast.error("שגיאה");
    else {
      toast.success(p.archived ? "שוחזר" : "הועבר לארכיון");
      void loadPlans();
    }
  }

  async function logout() {
    clearAdminToken();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function saveAsTemplate(plan: PlanRow) {
    const slug = generateSlug(`תבנית-${plan.name}`);
    const { data: newPlan, error: pe } = await supabase
      .from("plans")
      .insert({ slug, name: `תבנית: ${plan.name}`, subtitle: plan.subtitle, is_template: true })
      .select()
      .single();
    if (pe || !newPlan) { toast.error("שגיאה בשמירת תבנית"); return; }
    const { data: origTasks } = await supabase.from("tasks").select("*").eq("plan_id", plan.id);
    if (origTasks?.length) {
      const taskRows = origTasks.map((t) => ({
        plan_id: newPlan.id, title: t.title, department: t.department,
        priority: t.priority, status: "לא התחיל", note: t.note, position: t.position,
      }));
      const { data: newTasks } = await supabase.from("tasks").insert(taskRows).select();
      if (newTasks) {
        for (let i = 0; i < newTasks.length; i++) {
          const { data: origSteps } = await supabase.from("task_steps").select("*").eq("task_id", origTasks[i].id);
          if (origSteps?.length) {
            await supabase.from("task_steps").insert(
              origSteps.map((s) => ({ task_id: newTasks[i].id, content: s.content, position: s.position }))
            );
          }
        }
      }
    }
    toast.success("נשמר כתבנית — מופיעה בסעיף התבניות");
    void loadPlans();
  }

  async function createFromTemplate() {
    if (!templateDialog || !fromTemplateName.trim()) return;
    setFromTemplateCreating(true);
    const slug = generateSlug(fromTemplateName);
    const { data: newPlan, error: pe } = await supabase
      .from("plans")
      .insert({ slug, name: fromTemplateName.trim(), subtitle: templateDialog.subtitle, is_template: false })
      .select()
      .single();
    if (pe || !newPlan) { setFromTemplateCreating(false); toast.error("שגיאה ביצירה"); return; }
    const { data: origTasks } = await supabase.from("tasks").select("*").eq("plan_id", templateDialog.id);
    if (origTasks?.length) {
      const taskRows = origTasks.map((t) => ({
        plan_id: newPlan.id, title: t.title, department: t.department,
        priority: t.priority, status: "לא התחיל", note: t.note, position: t.position,
      }));
      const { data: newTasks } = await supabase.from("tasks").insert(taskRows).select();
      if (newTasks) {
        for (let i = 0; i < newTasks.length; i++) {
          const { data: origSteps } = await supabase.from("task_steps").select("*").eq("task_id", origTasks[i].id);
          if (origSteps?.length) {
            await supabase.from("task_steps").insert(
              origSteps.map((s) => ({ task_id: newTasks[i].id, content: s.content, position: s.position }))
            );
          }
        }
      }
    }
    setFromTemplateCreating(false);
    setTemplateDialog(null);
    navigate({ to: "/p/$slug", params: { slug } });
  }

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      let chosen = wb.SheetNames[0];
      for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        const joined = rows
          .slice(0, 15)
          .map((r) => (r as unknown[]).map((c) => String(c ?? "")).join("|"))
          .join("\n");
        if (joined.includes("מחלקה") && joined.includes("משימה")) { chosen = sn; break; }
      }
      const ws = wb.Sheets[chosen];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
      const parsed = parseSheetRows(rows as unknown[][]);
      if (parsed.tasks.length === 0) { toast.error("לא נמצאו משימות בקובץ"); return; }
      setPreview(parsed);
      setPreviewName(parsed.name);
      setPreviewSubtitle(parsed.subtitle ?? "");
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בקריאת הקובץ");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!preview) return;
    if (!previewName.trim()) { toast.error("חובה שם לתוכנית"); return; }
    setImporting(true);
    const slug = generateSlug(previewName);
    const { data: planRow, error: pe } = await supabase
      .from("plans")
      .insert({ slug, name: previewName.trim(), subtitle: previewSubtitle.trim() || null })
      .select()
      .single();
    if (pe || !planRow) { setImporting(false); toast.error("שגיאה ביצירת תוכנית: " + (pe?.message ?? "")); return; }
    const taskRows = preview.tasks.map((t, i) => ({
      plan_id: planRow.id, title: t.title, department: t.department,
      priority: t.priority, status: t.status, deadline: t.deadline, note: t.note, position: i,
    }));
    const { data: insertedTasks, error: te } = await supabase.from("tasks").insert(taskRows).select();
    if (te) { setImporting(false); toast.error("שגיאה בשמירת משימות: " + te.message); return; }
    const stepRows: Array<{ task_id: string; content: string; position: number }> = [];
    (insertedTasks ?? []).forEach((row, i) => {
      const t = preview.tasks[i];
      t.steps.forEach((s, j) => stepRows.push({ task_id: row.id, content: s, position: j }));
    });
    if (stepRows.length > 0) await supabase.from("task_steps").insert(stepRows);
    setImporting(false);
    setPreview(null);
    toast.success(`יובאו ${preview.tasks.length} משימות`);
    navigate({ to: "/p/$slug", params: { slug } });
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3 w-3" />
              דשבורד מנהל · סנכרון בזמן אמת
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              סקירת לקוחות ותוכניות
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ניהול ומעקב מרוכז אחרי כל תוכניות העבודה של הלקוחות
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/goals"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Target className="h-3.5 w-3.5" />
              יעדי צוות
            </Link>
            <Link
              to="/team"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Users className="h-3.5 w-3.5" />
              משימות הצוות
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-3.5 w-3.5" />
              הגדרות
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="ms-2 h-4 w-4" />
              יציאה
            </Button>
          </div>
        </header>

        {/* Master KPI strip */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label="לקוחות פעילים" value={plans.filter((p) => !p.archived).length} accent="primary" />
          <KpiCard label="סה״כ משימות" value={totals.t} />
          <KpiCard label="הושלמו" value={totals.d} accent="success" />
          <KpiCard label="דחופות פתוחות" value={totals.u} accent="urgent" />
          <KpiCard label="באיחור" value={totals.o} accent="warning" />
        </div>

        {/* Create + Import */}
        <Card className="mb-8 p-6 shadow-[var(--shadow-elevated)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">תוכנית חדשה</h2>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Upload className="ms-2 h-4 w-4" />}
              ייבוא מ-Excel / Sheets
            </Button>
          </div>
          <form onSubmit={createPlan} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="שם הלקוח / שם התוכנית" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="תת-כותרת (אופציונלי)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            <Button type="submit" disabled={creating}>
              <Plus className="ms-2 h-4 w-4" />
              {creating ? "יוצר…" : "צור תוכנית"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            <FileSpreadsheet className="ms-1 inline h-3 w-3" />
            מ-Google Sheets: קובץ ← הורדה ← Microsoft Excel (.xlsx) ואז העלו כאן
          </p>

          {/* Templates */}
          {templates.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <LayoutTemplate className="h-3.5 w-3.5" />
                צור מתבנית מוכנה
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplateDialog(t); setFromTemplateName(""); }}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <BookCopy className="h-3 w-3" />
                    {t.name.replace("תבנית: ", "")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Search & filter */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש תוכנית או לקוח…" className="pe-9" />
          </div>
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
            <Archive className="ms-2 h-3.5 w-3.5" />
            {showArchived ? "מציג ארכיון" : "ארכיון"}
          </Button>
        </div>

        {/* Plans grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {visiblePlans.map((p) => {
            const s = stats[p.id] ?? { total: 0, done: 0, urgent: 0, overdue: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const score = calcHealthScore(s);
            return (
              <Card
                key={p.id}
                className="group relative overflow-hidden p-5 transition-all hover:shadow-[var(--shadow-elevated)]"
                style={{
                  borderInlineStartWidth: 4,
                  borderInlineStartStyle: "solid",
                  borderInlineStartColor: p.accent_color ?? "#2D4A6B",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link to="/p/$slug" params={{ slug: p.slug }} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-border" style={{ backgroundColor: p.accent_color ?? "#2D4A6B" }} />
                      <div className="truncate text-base font-semibold tracking-tight text-foreground group-hover:text-primary">{p.name}</div>
                    </div>
                    {p.subtitle && <div className="mt-0.5 truncate text-sm text-muted-foreground">{p.subtitle}</div>}
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-2xl font-semibold tabular-nums text-foreground">{pct}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">הושלם</div>
                    <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-semibold", healthScoreBadge(score))}>
                      {healthScoreLabel(score)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{s.total} משימות</span>
                  <span className="text-success">✓ {s.done}</span>
                  {s.urgent > 0 && <span className="text-urgent">● {s.urgent} דחופות</span>}
                  {s.overdue > 0 && <span className="text-warning-foreground">⚠ {s.overdue} באיחור</span>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyShareLink(p.share_token)}>
                      <Share2 className="ms-2 h-3.5 w-3.5" />
                      לינק ללקוח
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-primary"
                      title="שמור כתבנית"
                      onClick={() => saveAsTemplate(p)}
                    >
                      <LayoutTemplate className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Link
                      to="/p/$slug"
                      params={{ slug: p.slug }}
                      className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                    >
                      פתח <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
          {visiblePlans.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {showArchived ? "אין תוכניות בארכיון" : "אין עדיין תוכניות — צרו את הראשונה למעלה"}
            </div>
          )}
        </div>
      </div>

      {/* Import preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>תצוגה מקדימה של ייבוא</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                זוהו <strong>{preview.tasks.length}</strong> משימות
                {" · "}
                {preview.tasks.reduce((a, t) => a + t.steps.length, 0)} תתי-משימות
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">שם התוכנית</label>
                <Input value={previewName} onChange={(e) => setPreviewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">תת-כותרת</label>
                <Input value={previewSubtitle} onChange={(e) => setPreviewSubtitle(e.target.value)} />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {preview.tasks.slice(0, 8).map((t, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-sm last:border-0">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.department ?? "—"} · {t.priority}{t.deadline ? ` · ${t.deadline}` : ""}
                    </div>
                  </div>
                ))}
                {preview.tasks.length > 8 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">ועוד {preview.tasks.length - 8} משימות…</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={importing}>ביטול</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              צור תוכנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create from template dialog */}
      <Dialog open={!!templateDialog} onOpenChange={(o) => !o && setTemplateDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>צור מתבנית: {templateDialog?.name.replace("תבנית: ", "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">הזן שם ללקוח/תוכנית החדשה</p>
            <Input
              autoFocus
              placeholder="שם הלקוח"
              value={fromTemplateName}
              onChange={(e) => setFromTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createFromTemplate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(null)} disabled={fromTemplateCreating}>ביטול</Button>
            <Button onClick={createFromTemplate} disabled={fromTemplateCreating || !fromTemplateName.trim()}>
              {fromTemplateCreating && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              צור תוכנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "primary" | "success" | "urgent" | "warning";
}) {
  const color =
    accent === "primary" ? "text-primary"
    : accent === "success" ? "text-success"
    : accent === "urgent" ? "text-urgent"
    : accent === "warning" ? "text-warning-foreground"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}

void PRIORITY_ORDER;

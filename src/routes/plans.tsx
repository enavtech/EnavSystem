import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateSlug, parseSheetRows, type ParsedPlan,
  PRIORITY_ORDER, calcHealthScore, healthScoreBadge, healthScoreLabel,
} from "@/lib/plans";
import {
  Plus, Upload, FileSpreadsheet, Loader2, Share2,
  Search, Archive, ChevronRight, LayoutTemplate, BookCopy,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { isAdmin } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/plans")({
  component: PlansPage,
  head: () => ({ meta: [{ title: "תוכניות לקוח" }] }),
});

type PlanRow = {
  id: string; slug: string; name: string; subtitle: string | null;
  share_token: string; archived: boolean; is_template: boolean;
  updated_at: string; accent_color: string | null;
};
type PlanStats = Record<string, { total: number; done: number; urgent: number; overdue: number }>;

function PlansPage() {
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    setAuthed(true);
    supabase.auth.getUser().then(({ data }) => {
      setUserRole((data.user?.user_metadata?.role as string) ?? null);
    });
  }, [navigate]);

  useEffect(() => { if (authed) void loadPlans(); }, [authed]);

  async function loadPlans() {
    const { data: planRows } = await supabase
      .from("plans")
      .select("id,slug,name,subtitle,share_token,archived,updated_at,accent_color,is_template")
      .order("updated_at", { ascending: false });
    const list = (planRows ?? []) as PlanRow[];
    const realPlans = list.filter((p) => !p.is_template);
    setPlans(realPlans);
    setTemplates(list.filter((p) => p.is_template));
    const ids = realPlans.map((p) => p.id);
    if (!ids.length) return;
    const { data: tasks } = await supabase.from("tasks").select("plan_id,status,priority,deadline").in("plan_id", ids);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const map: PlanStats = {};
    realPlans.forEach((p) => { map[p.id] = { total: 0, done: 0, urgent: 0, overdue: 0 }; });
    (tasks ?? []).forEach((t) => {
      const s = map[t.plan_id]; if (!s) return;
      s.total += 1;
      if (t.status === "הושלם") s.done += 1;
      if (t.priority === "דחופה" && t.status !== "הושלם") s.urgent += 1;
      if (t.deadline && t.status !== "הושלם") {
        const d = new Date(t.deadline); d.setHours(0, 0, 0, 0);
        if (d.getTime() < today.getTime()) s.overdue += 1;
      }
    });
    setStats(map);
  }

  const visiblePlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (p.archived !== showArchived) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q);
    });
  }, [plans, search, showArchived]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("חובה להזין שם"); return; }
    setCreating(true);
    const slug = generateSlug(name);
    const { error } = await supabase.from("plans").insert({ slug, name: name.trim(), subtitle: subtitle.trim() || null });
    setCreating(false);
    if (error) { toast.error("שגיאה: " + error.message); return; }
    navigate({ to: "/p/$slug", params: { slug } });
  }

  async function copyShareLink(token: string) {
    const url = `${window.location.origin}/c/${token}`;
    try { await navigator.clipboard.writeText(url); toast.success("הלינק הועתק"); }
    catch { toast.error("לא הצלחתי להעתיק"); }
  }

  async function toggleArchive(p: PlanRow) {
    const { error } = await supabase.from("plans").update({ archived: !p.archived }).eq("id", p.id);
    if (error) toast.error("שגיאה");
    else { toast.success(p.archived ? "שוחזר" : "הועבר לארכיון"); void loadPlans(); }
  }

  async function saveAsTemplate(plan: PlanRow) {
    const slug = generateSlug(`תבנית-${plan.name}`);
    const { data: newPlan, error: pe } = await supabase
      .from("plans").insert({ slug, name: `תבנית: ${plan.name}`, subtitle: plan.subtitle, is_template: true }).select().single();
    if (pe || !newPlan) { toast.error("שגיאה בשמירת תבנית"); return; }
    const { data: origTasks } = await supabase.from("tasks").select("*").eq("plan_id", plan.id);
    if (origTasks?.length) {
      const taskRows = origTasks.map((t) => ({ plan_id: newPlan.id, title: t.title, department: t.department, priority: t.priority, status: "לא התחיל", note: t.note, position: t.position }));
      const { data: newTasks } = await supabase.from("tasks").insert(taskRows).select();
      if (newTasks) {
        for (let i = 0; i < newTasks.length; i++) {
          const { data: origSteps } = await supabase.from("task_steps").select("*").eq("task_id", origTasks[i].id);
          if (origSteps?.length) await supabase.from("task_steps").insert(origSteps.map((s) => ({ task_id: newTasks[i].id, content: s.content, position: s.position })));
        }
      }
    }
    toast.success("נשמר כתבנית"); void loadPlans();
  }

  async function createFromTemplate() {
    if (!templateDialog || !fromTemplateName.trim()) return;
    setFromTemplateCreating(true);
    const slug = generateSlug(fromTemplateName);
    const { data: newPlan, error: pe } = await supabase
      .from("plans").insert({ slug, name: fromTemplateName.trim(), subtitle: templateDialog.subtitle, is_template: false }).select().single();
    if (pe || !newPlan) { setFromTemplateCreating(false); toast.error("שגיאה"); return; }
    const { data: origTasks } = await supabase.from("tasks").select("*").eq("plan_id", templateDialog.id);
    if (origTasks?.length) {
      const taskRows = origTasks.map((t) => ({ plan_id: newPlan.id, title: t.title, department: t.department, priority: t.priority, status: "לא התחיל", note: t.note, position: t.position }));
      const { data: newTasks } = await supabase.from("tasks").insert(taskRows).select();
      if (newTasks) {
        for (let i = 0; i < newTasks.length; i++) {
          const { data: origSteps } = await supabase.from("task_steps").select("*").eq("task_id", origTasks[i].id);
          if (origSteps?.length) await supabase.from("task_steps").insert(origSteps.map((s) => ({ task_id: newTasks[i].id, content: s.content, position: s.position })));
        }
      }
    }
    setFromTemplateCreating(false); setTemplateDialog(null);
    navigate({ to: "/p/$slug", params: { slug: newPlan.slug } });
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
        const joined = rows.slice(0, 15).map((r) => (r as unknown[]).map((c) => String(c ?? "")).join("|")).join("\n");
        if (joined.includes("מחלקה") && joined.includes("משימה")) { chosen = sn; break; }
      }
      const ws = wb.Sheets[chosen];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
      const parsed = parseSheetRows(rows as unknown[][]);
      if (parsed.tasks.length === 0) { toast.error("לא נמצאו משימות בקובץ"); return; }
      setPreview(parsed); setPreviewName(parsed.name); setPreviewSubtitle(parsed.subtitle ?? "");
    } catch (err) { console.error(err); toast.error("שגיאה בקריאת הקובץ"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function confirmImport() {
    if (!preview || !previewName.trim()) { toast.error("חובה שם"); return; }
    setImporting(true);
    const slug = generateSlug(previewName);
    const { data: planRow, error: pe } = await supabase.from("plans").insert({ slug, name: previewName.trim(), subtitle: previewSubtitle.trim() || null }).select().single();
    if (pe || !planRow) { setImporting(false); toast.error("שגיאה: " + (pe?.message ?? "")); return; }
    const taskRows = preview.tasks.map((t, i) => ({ plan_id: planRow.id, title: t.title, department: t.department, priority: t.priority, status: t.status, deadline: t.deadline, note: t.note, position: i }));
    const { data: insertedTasks, error: te } = await supabase.from("tasks").insert(taskRows).select();
    if (te) { setImporting(false); toast.error("שגיאה: " + te.message); return; }
    const stepRows: Array<{ task_id: string; content: string; position: number }> = [];
    (insertedTasks ?? []).forEach((row, i) => { preview.tasks[i].steps.forEach((s, j) => stepRows.push({ task_id: row.id, content: s, position: j })); });
    if (stepRows.length > 0) await supabase.from("task_steps").insert(stepRows);
    setImporting(false); setPreview(null);
    toast.success(`יובאו ${preview.tasks.length} משימות`);
    navigate({ to: "/p/$slug", params: { slug } });
  }

  if (!authed) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    </AppShell>
  );

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      {/* Header */}
      <div className="border-b border-border bg-white px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">תוכניות לקוח</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">ניהול תוכניות עבודה ומשימות ללקוחות</p>
          </div>
          {userRole === "admin" && (
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}
                className="glass inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/10 disabled:opacity-50">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-primary" />}
                ייבוא Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-7 py-6">
        {/* Create form */}
        {userRole === "admin" && (
          <div className="glass-strong glass-top mb-6 rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Plus className="h-4 w-4 text-primary" /> תוכנית חדשה
            </h2>
            <form onSubmit={createPlan} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input placeholder="שם הלקוח / שם התוכנית" value={name} onChange={(e) => setName(e.target.value)} className="border-border bg-white focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <Input placeholder="תת-כותרת (אופציונלי)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="border-border bg-white focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <button type="submit" disabled={creating} className="btn-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <Plus className="h-4 w-4" />{creating ? "יוצר…" : "צור תוכנית"}
              </button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground"><FileSpreadsheet className="ms-1 inline h-3 w-3" /> Google Sheets: קובץ ← הורדה ← Microsoft Excel (.xlsx)</p>
            {templates.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><LayoutTemplate className="h-3.5 w-3.5" />צור מתבנית</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => { setTemplateDialog(t); setFromTemplateName(""); }}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/15">
                      <BookCopy className="h-3 w-3" />{t.name.replace("תבנית: ", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש תוכנית…" className="border-border bg-white pe-9 focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </div>
          <button onClick={() => setShowArchived(!showArchived)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              showArchived ? "border-primary/40 bg-primary/15 text-primary" : "glass text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
            <Archive className="h-3.5 w-3.5" />{showArchived ? "מציג ארכיון" : "ארכיון"}
          </button>
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {visiblePlans.map((p) => {
            const s = stats[p.id] ?? { total: 0, done: 0, urgent: 0, overdue: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const score = calcHealthScore(s);
            const accentColor = p.accent_color ?? "#4f70e8";
            return (
              <div key={p.id}
                className="glass-strong glass-top group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                style={{ borderInlineStartWidth: 3, borderInlineStartStyle: "solid", borderInlineStartColor: accentColor + "99" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${accentColor}33, 0 8px 32px oklch(0 0 0 / 0.08)`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link to="/p/$slug" params={{ slug: p.slug }} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
                      <div className="truncate text-base font-semibold text-foreground group-hover:text-primary">{p.name}</div>
                    </div>
                    {p.subtitle && <div className="mt-0.5 truncate ps-4 text-sm text-muted-foreground">{p.subtitle}</div>}
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-2xl font-bold tabular-nums" style={{ color: accentColor }}>{pct}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">הושלם</div>
                    <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-semibold", healthScoreBadge(score))}>{healthScoreLabel(score)}</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})` }} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{s.total} משימות</span>
                  <span className="text-success">✓ {s.done}</span>
                  {s.urgent > 0 && <span className="text-urgent">● {s.urgent} דחופות</span>}
                  {s.overdue > 0 && <span className="text-warning-foreground">⚠ {s.overdue} באיחור</span>}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => copyShareLink(p.share_token)}>
                      <Share2 className="ms-1.5 h-3.5 w-3.5" />לינק ללקוח
                    </Button>
                    {userRole === "admin" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary" title="שמור כתבנית" onClick={() => saveAsTemplate(p)}>
                        <LayoutTemplate className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => toggleArchive(p)}><Archive className="h-3.5 w-3.5" /></Button>
                    <Link to="/p/$slug" params={{ slug: p.slug }} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:gap-1">
                      פתח <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
          {visiblePlans.length === 0 && (
            <div className="glass col-span-full rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {showArchived ? "אין תוכניות בארכיון" : "אין עדיין תוכניות"}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>תצוגה מקדימה</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">זוהו <strong>{preview.tasks.length}</strong> משימות · {preview.tasks.reduce((a, t) => a + t.steps.length, 0)} תתי-משימות</div>
              <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">שם התוכנית</label><Input value={previewName} onChange={(e) => setPreviewName(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">תת-כותרת</label><Input value={previewSubtitle} onChange={(e) => setPreviewSubtitle(e.target.value)} /></div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {preview.tasks.slice(0, 8).map((t, i) => (
                  <div key={i} className="border-b border-border px-3 py-2 text-sm last:border-0">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.department ?? "—"} · {t.priority}{t.deadline ? ` · ${t.deadline}` : ""}</div>
                  </div>
                ))}
                {preview.tasks.length > 8 && <div className="px-3 py-2 text-xs text-muted-foreground">ועוד {preview.tasks.length - 8} משימות…</div>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={importing}>ביטול</Button>
            <Button onClick={confirmImport} disabled={importing}>{importing && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}צור תוכנית</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!templateDialog} onOpenChange={(o) => !o && setTemplateDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>צור מתבנית: {templateDialog?.name.replace("תבנית: ", "")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">הזן שם ללקוח/תוכנית החדשה</p>
            <Input autoFocus placeholder="שם הלקוח" value={fromTemplateName} onChange={(e) => setFromTemplateName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createFromTemplate(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(null)} disabled={fromTemplateCreating}>ביטול</Button>
            <Button onClick={createFromTemplate} disabled={fromTemplateCreating || !fromTemplateName.trim()}>
              {fromTemplateCreating && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}צור תוכנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

void PRIORITY_ORDER;

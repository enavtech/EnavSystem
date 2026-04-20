import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { generateSlug, parseSheetRows, type ParsedPlan } from "@/lib/plans";
import { Plus, ExternalLink, Sparkles, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [plans, setPlans] = useState<Array<{ id: string; slug: string; name: string; subtitle: string | null; updated_at: string }>>([]);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedPlan | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewSubtitle, setPreviewSubtitle] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("plans")
      .select("id,slug,name,subtitle,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPlans(data ?? []));
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("חובה להזין שם");
      return;
    }
    setCreating(true);
    const slug = generateSlug(name);
    const { error } = await supabase
      .from("plans")
      .insert({ slug, name: name.trim(), subtitle: subtitle.trim() || null });
    setCreating(false);
    if (error) {
      toast.error("שגיאה ביצירה: " + error.message);
      return;
    }
    navigate({ to: "/p/$slug", params: { slug } });
  }

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      // Prefer sheet that contains the task header
      let chosen = wb.SheetNames[0];
      for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        const joined = rows
          .slice(0, 15)
          .map((r) => (r as unknown[]).map((c) => String(c ?? "")).join("|"))
          .join("\n");
        if (joined.includes("מחלקה") && joined.includes("משימה")) {
          chosen = sn;
          break;
        }
      }
      const ws = wb.Sheets[chosen];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
      const parsed = parseSheetRows(rows as unknown[][]);
      if (parsed.tasks.length === 0) {
        toast.error("לא נמצאו משימות בקובץ");
        return;
      }
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
    if (!previewName.trim()) {
      toast.error("חובה שם לתוכנית");
      return;
    }
    setImporting(true);
    const slug = generateSlug(previewName);
    const { data: planRow, error: pe } = await supabase
      .from("plans")
      .insert({ slug, name: previewName.trim(), subtitle: previewSubtitle.trim() || null })
      .select()
      .single();
    if (pe || !planRow) {
      setImporting(false);
      toast.error("שגיאה ביצירת תוכנית: " + (pe?.message ?? ""));
      return;
    }
    const taskRows = preview.tasks.map((t, i) => ({
      plan_id: planRow.id,
      title: t.title,
      department: t.department,
      priority: t.priority,
      status: t.status,
      deadline: t.deadline,
      note: t.note,
      position: i,
    }));
    const { data: insertedTasks, error: te } = await supabase
      .from("tasks")
      .insert(taskRows)
      .select();
    if (te) {
      setImporting(false);
      toast.error("שגיאה בשמירת משימות: " + te.message);
      return;
    }
    const stepRows: Array<{ task_id: string; content: string; position: number }> = [];
    (insertedTasks ?? []).forEach((row, i) => {
      const t = preview.tasks[i];
      t.steps.forEach((s, j) => stepRows.push({ task_id: row.id, content: s, position: j }));
    });
    if (stepRows.length > 0) {
      await supabase.from("task_steps").insert(stepRows);
    }
    setImporting(false);
    setPreview(null);
    toast.success(`יובאו ${preview.tasks.length} משימות`);
    navigate({ to: "/p/$slug", params: { slug } });
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3 w-3" />
            סנכרון בזמן אמת · שיתוף בלינק
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground">
            תוכניות עבודה שיתופיות
          </h1>
          <p className="mt-2 text-muted-foreground">
            צרו תוכנית, שתפו את הלינק עם הלקוח — כל אחד יכול לערוך, לסמן ולהגיב
          </p>
        </header>

        <Card className="mb-8 p-6 shadow-[var(--shadow-elevated)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">תוכנית חדשה</h2>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="ms-2 h-4 w-4" />
              )}
              ייבוא מ-Excel / Sheets
            </Button>
          </div>
          <form onSubmit={createPlan} className="space-y-3">
            <Input
              placeholder="שם הלקוח / שם התוכנית"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base"
            />
            <Input
              placeholder="תת-כותרת (אופציונלי)"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
            <Button type="submit" disabled={creating} className="w-full sm:w-auto">
              <Plus className="ms-2 h-4 w-4" />
              {creating ? "יוצר…" : "צור תוכנית"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            <FileSpreadsheet className="ms-1 inline h-3 w-3" />
            מ-Google Sheets: קובץ ← הורדה ← Microsoft Excel (.xlsx) ואז העלו כאן
          </p>
        </Card>

        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          תוכניות קיימות ({plans.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <Link
              key={p.id}
              to="/p/$slug"
              params={{ slug: p.slug }}
              className="group block"
            >
              <Card className="p-4 transition-all hover:shadow-[var(--shadow-elevated)] hover:border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {p.name}
                    </div>
                    {p.subtitle && (
                      <div className="truncate text-sm text-muted-foreground">
                        {p.subtitle}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Card>
            </Link>
          ))}
          {plans.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              עדיין אין תוכניות — צרו את הראשונה למעלה
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>תצוגה מקדימה של ייבוא</DialogTitle>
          </DialogHeader>
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
                      {t.department ?? "—"} · {t.priority}
                      {t.deadline ? ` · ${t.deadline}` : ""}
                    </div>
                  </div>
                ))}
                {preview.tasks.length > 8 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    ועוד {preview.tasks.length - 8} משימות…
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={importing}>
              ביטול
            </Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              צור תוכנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

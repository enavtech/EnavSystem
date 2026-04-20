import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { generateSlug } from "@/lib/plans";
import { Plus, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [plans, setPlans] = useState<Array<{ id: string; slug: string; name: string; subtitle: string | null; updated_at: string }>>([]);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
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
          <h2 className="mb-4 text-lg font-semibold">תוכנית חדשה</h2>
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
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loginAdminBySession } from "@/lib/admin-api";
import { setAdminToken, isAdmin } from "@/lib/admin-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "כניסה" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin()) navigate({ to: "/" });
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw new Error("כניסה נכשלה: " + authError.message);
      if (!authData.session) throw new Error("לא התקבלה סשן");

      const r = await loginAdminBySession({
        data: { accessToken: authData.session.access_token },
      });
      setAdminToken(r.token);
      toast.success("התחברת");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בכניסה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Toaster position="top-center" dir="rtl" />

      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="hidden flex-1 flex-col items-center justify-center p-12 lg:flex"
        style={{ background: "oklch(0.17 0.052 258)" }}
      >
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">מערכת ניהול ייעוץ</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "oklch(0.70 0.04 258)" }}>
            ניהול תוכניות עבודה, מעקב משימות ושיתוף עם לקוחות — הכל במקום אחד
          </p>

          {/* Decorative stat cards */}
          <div className="mt-10 grid grid-cols-2 gap-3 text-start">
            {[
              { label: "לקוחות פעילים", value: "48" },
              { label: "משימות שהושלמו", value: "94%" },
              { label: "תוכניות פעילות", value: "12" },
              { label: "חברי צוות", value: "6" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3"
                style={{ background: "oklch(1 0 0 / 0.07)", border: "1px solid oklch(1 0 0 / 0.10)" }}
              >
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="mt-0.5 text-xs" style={{ color: "oklch(0.65 0.04 258)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">

          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">מערכת ניהול ייעוץ</h1>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">ברוכים הבאים</h1>
            <p className="mt-1 text-sm text-muted-foreground">היכנסו לחשבון שלכם להמשך</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                כתובת מייל
              </label>
              <Input
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                dir="ltr"
                className="h-11 rounded-xl border-border bg-white text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                סיסמה
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-border bg-white text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-gradient mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "מתחבר…" : "כניסה למערכת"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

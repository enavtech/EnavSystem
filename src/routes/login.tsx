import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getAdminStatus,
  loginAdmin,
  setupAdminPassword,
  loginAdminBySession,
} from "@/lib/admin-api";
import { setAdminToken, isAdmin } from "@/lib/admin-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Lock, Loader2, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "כניסת מנהל" }] }),
});

type Mode = "check" | "login" | "setup" | "team-login";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("check");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // For secondary admins (email + password)
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin()) {
      navigate({ to: "/" });
      return;
    }
    getAdminStatus()
      .then((r) => setMode(r.hasPassword ? "login" : "setup"))
      .catch(() => setMode("login"));
  }, [navigate]);

  // ── Primary admin login / setup ─────────────────────────────────────────

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      if (mode === "setup") {
        if (password !== confirm) {
          toast.error("הסיסמאות לא תואמות");
          return;
        }
        if (password.length < 6) {
          toast.error("סיסמה חייבת לפחות 6 תווים");
          return;
        }
        const r = await setupAdminPassword({ data: { password } });
        setAdminToken(r.token);
        await signInWithOtp(r.authEmail, r.emailOtp);
        toast.success("סיסמת מנהל נקבעה");
      } else {
        const r = await loginAdmin({ data: { password } });
        setAdminToken(r.token);
        await signInWithOtp(r.authEmail, r.emailOtp);
        toast.success("התחברת");
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בכניסה");
    } finally {
      setLoading(false);
    }
  }

  // Uses the server-generated OTP to create a Supabase Auth session.
  // This session is what gives RLS its "authenticated" role.
  async function signInWithOtp(authEmail: string, emailOtp: string | null) {
    if (!emailOtp) return; // graceful degradation (writes will fail RLS, but UI still works)
    const { error } = await supabase.auth.verifyOtp({
      email: authEmail,
      token: emailOtp,
      type: "email",
    });
    if (error) console.warn("Supabase session setup failed:", error.message);
  }

  // ── Secondary admin login (email + password) ────────────────────────────

  async function submitTeamLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      // Sign into Supabase Auth directly
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw new Error("כניסה נכשלה: " + authError.message);
      if (!authData.session) throw new Error("לא התקבלה סשן");

      // Verify role and get HMAC token
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

  // ── Render ──────────────────────────────────────────────────────────────

  if (mode === "check") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Secondary admin login mode
  if (mode === "team-login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 px-4">
        <Toaster position="top-center" dir="rtl" />
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)]">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">כניסת חבר צוות</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              הכניסו את כתובת המייל והסיסמה שקיבלתם
            </p>
          </div>
          <form onSubmit={submitTeamLogin} className="space-y-3">
            <Input
              type="email"
              placeholder="כתובת מייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              dir="ltr"
            />
            <Input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              התחבר
            </Button>
          </form>
          <button
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setMode("login"); setEmail(""); setPassword(""); }}
          >
            ← חזרה לכניסת מנהל ראשי
          </button>
        </Card>
      </div>
    );
  }

  // Primary admin login / first-time setup
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 px-4">
      <Toaster position="top-center" dir="rtl" />
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {mode === "setup" ? <ShieldCheck className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "setup" ? "הגדרת סיסמת מנהל" : "כניסת מנהל"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "setup"
              ? "זוהי הפעם הראשונה — בחרו סיסמה חזקה."
              : "הכניסו את הסיסמה כדי לנהל תוכניות"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {mode === "setup" && (
            <Input
              type="password"
              placeholder="אישור סיסמה"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            {mode === "setup" ? "קבע סיסמה" : "התחבר"}
          </Button>
        </form>

        {mode === "login" && (
          <button
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setMode("team-login"); setPassword(""); }}
          >
            כניסה כחבר צוות ←
          </button>
        )}
      </Card>
    </div>
  );
}

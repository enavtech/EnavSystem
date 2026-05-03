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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 px-4">
      <Toaster position="top-center" dir="rtl" />
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">כניסה למערכת</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הכניסו את כתובת המייל והסיסמה שלכם
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
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
      </Card>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getAdminStatus,
  loginAdmin,
  setupAdminPassword,
} from "@/lib/admin-api";
import { setAdminToken, isAdmin } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Lock, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "כניסת מנהל" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"check" | "login" | "setup">("check");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      if (mode === "setup") {
        if (password !== confirm) {
          toast.error("הסיסמאות לא תואמות");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error("סיסמה צריכה לפחות 6 תווים");
          setLoading(false);
          return;
        }
        const r = await setupAdminPassword({ data: { password } });
        setAdminToken(r.token);
        toast.success("סיסמת מנהל נקבעה");
      } else {
        const r = await loginAdmin({ data: { password } });
        setAdminToken(r.token);
        toast.success("התחברת");
      }
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
            {mode === "setup" ? <ShieldCheck className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "setup" ? "הגדרת סיסמת מנהל" : "כניסת מנהל"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "setup"
              ? "זוהי הפעם הראשונה שאתם נכנסים — בחרו סיסמה חזקה."
              : "הכניסו את הסיסמה כדי לנהל תוכניות"}
          </p>
        </div>

        {mode === "check" ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
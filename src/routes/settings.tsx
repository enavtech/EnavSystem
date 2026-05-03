import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAdmin } from "@/lib/admin-session";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminRole,
  deleteAdminUser,
  type AdminUser,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  Pencil,
  Crown,
  Users,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const ROLES = [
  { value: "admin",      label: "מנהל",          desc: "גישה מלאה — יצירה, עריכה, מחיקה",    Icon: ShieldCheck },
  { value: "consultant", label: "יועץ",           desc: "עריכת תוכניות, ללא מחיקה",            Icon: Pencil },
  { value: "viewer",     label: "צפייה בלבד",    desc: "קריאה בלבד, ללא שינויים",             Icon: Eye },
] as const;

function roleLabel(r: string) {
  return ROLES.find((x) => x.value === r)?.label ?? r;
}

function RoleIcon({ role, className }: { role: string; className?: string }) {
  const found = ROLES.find((x) => x.value === role);
  const Icon = found?.Icon ?? Eye;
  return <Icon className={cn("h-4 w-4", className)} />;
}

function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("consultant");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit role dialog
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<string>("consultant");
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      navigate({ to: "/login" });
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role as string | undefined;
      if (role !== "admin") {
        navigate({ to: "/" });
        return;
      }
      void loadUsers();
    });
  }, [navigate]);

  async function loadUsers() {
    try {
      const list = await listAdminUsers();
      setUsers(list);
    } catch (err) {
      toast.error("שגיאה בטעינת המשתמשים");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      await createAdminUser({
        data: {
          email: newEmail.trim(),
          name: newName.trim() || newEmail.trim(),
          role: newRole,
          password: newPassword,
        },
      });
      toast.success("המשתמש נוצר בהצלחה");
      setShowCreate(false);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("consultant");
      void loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירה");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      await updateAdminRole({ data: { userId: editUser.id, role: editRole, name: editName } });
      toast.success("הרשאות עודכנו");
      setEditUser(null);
      void loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`למחוק את ${user.name}? הם לא יוכלו להיכנס למערכת.`)) return;
    try {
      await deleteAdminUser({ data: { userId: user.id } });
      toast.success("המשתמש הוסר");
      void loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            חזרה לדשבורד
          </Link>
        </div>

        {/* Header */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            הגדרות מערכת
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">ניהול מנהלים</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הוסף חברי צוות עם הרשאות שונות לגישה למערכת
          </p>
        </header>

        {/* Roles legend */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {ROLES.map(({ value, label, desc, Icon }) => (
            <Card key={value} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>

        {/* Users list */}
        <Card className="mb-4">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              מנהלים פעילים
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                {users.length}
              </span>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="me-1.5 h-3.5 w-3.5" />
              הוסף מנהל
            </Button>
          </div>

          <div className="divide-y divide-border">
            {users.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                אין עדיין מנהלים נוספים.
              </p>
            )}
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                    u.is_primary ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{u.name}</span>
                    {u.is_primary && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Crown className="h-2.5 w-2.5" />
                        ראשי
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span dir="ltr">{u.is_primary ? "admin@system.local" : u.email}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <RoleIcon role={u.role} />
                      {roleLabel(u.role)}
                    </span>
                  </div>
                </div>
                {!u.is_primary && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="ערוך הרשאות"
                      onClick={() => {
                        setEditUser(u);
                        setEditRole(u.role);
                        setEditName(u.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="הסר מנהל"
                      onClick={() => handleDelete(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-urgent" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Security note */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <KeyRound className="mb-1.5 h-4 w-4 text-primary" />
          <p className="font-medium text-foreground mb-1">אבטחה</p>
          <p>כל מנהל מקבל גישה מאובטחת דרך Supabase Auth. הסיסמאות מוצפנות ואינן נשמרות בטקסט גלוי. השתמש בסיסמאות חזקות ואחרות לכל משתמש.</p>
        </div>
      </div>

      {/* ── Create admin dialog ───────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוסף מנהל חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                כתובת מייל *
              </label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                שם תצוגה
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שם מלא"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                סיסמה זמנית *
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                מסור למנהל לשנות אחר כך
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                תפקיד
              </label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r.value !== "admin").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label} — {r.desc}
                    </SelectItem>
                  ))}
                  <SelectItem value="admin">מנהל — גישה מלאה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={creating || !newEmail.trim() || !newPassword.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "צור מנהל"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit role dialog ──────────────────────────────────────────────── */}
      {editUser && (
        <Dialog open onOpenChange={() => setEditUser(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>עריכת הרשאות — {editUser.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">שם</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">תפקיד</label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} — {r.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditUser(null)}>ביטול</Button>
              <Button onClick={handleUpdate} disabled={editSaving}>
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

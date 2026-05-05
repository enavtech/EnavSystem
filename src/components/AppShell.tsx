import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { clearAdminToken } from "@/lib/admin-session";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  UserCheck,
  CalendarDays,
  Film,
  Target,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  FolderKanban,
  Building2,
} from "lucide-react";

const NAV = [
  { to: "/",         label: "דשבורד",          icon: LayoutDashboard },
  { to: "/crm",      label: "לידים",             icon: UserCheck },
  { to: "/clients",  label: "לקוחות",           icon: Building2 },
  { to: "/plans",    label: "תוכניות לקוח",    icon: FolderKanban },
  { to: "/meetings", label: "פגישות",           icon: CalendarDays },
  { to: "/content",  label: "תוכן פרודקשן",    icon: Film },
  { to: "/goals",    label: "יעדי צוות",        icon: Target },
  { to: "/team",     label: "צוות",             icon: Users },
  { to: "/settings", label: "הגדרות",           icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const path = location.pathname;

  async function logout() {
    clearAdminToken();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen" style={{ direction: "rtl" }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-56 flex-col"
        style={{ background: "oklch(0.17 0.052 258)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">מערכת ניהול</div>
            <div className="text-[10px]" style={{ color: "oklch(0.60 0.04 258)" }}>
              ייעוץ עסקי
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px" style={{ background: "oklch(1 0 0 / 0.07)" }} />

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : "text-white/55 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-white/45 group-hover:text-white"
                  )}
                />
                <span className="truncate">{label}</span>
                {isActive && (
                  <span className="me-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 pt-2" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
            style={{ color: "oklch(0.55 0.03 258)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.60 0.22 25 / 0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.70 0.20 25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.55 0.03 258)";
            }}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>יציאה</span>
          </button>
        </div>
      </aside>

      {/* ── Main content (shifted away from sidebar) ──────── */}
      <main className="min-w-0 flex-1" style={{ marginRight: "14rem" }}>
        {children}
      </main>
    </div>
  );
}

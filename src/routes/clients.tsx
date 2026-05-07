import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Search, Plus, Phone, Mail, Building2, CalendarDays, Loader2, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients")({
  component: ClientsLayout,
});

// ClientsLayout — shows the child route (profile page) OR the list
function ClientsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isExact = pathname === "/clients" || pathname === "/clients/";
  if (!isExact) {
    return <Outlet />;
  }
  return <ClientsPage />;
}

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  notes: string | null;
  assigned_to: string | null;
  plan_id: string | null;
  client_status: string | null;
  client_since: string | null;
  industry: string | null;
  initial_revenue: string | null;
  business_goals: string | null;
  service_type: string | null;
  city: string | null;
  created_at: string;
};

const STATUS_CFG = {
  active: { label: "פעיל",    cls: "badge-success" },
  paused: { label: "מושהה",   cls: "badge-warning" },
  ended:  { label: "הסתיים",  cls: "badge-urgent"  },
} as const;

const AVATAR_COLORS = [
  "oklch(0.60 0.20 250)",
  "oklch(0.62 0.17 149)",
  "oklch(0.54 0.20 285)",
  "oklch(0.68 0.17 78)",
  "oklch(0.60 0.22 25)",
  "oklch(0.56 0.19 192)",
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FORM = {
  name: "", business_name: "", phone: "", email: "",
  city: "", website: "", industry: "", business_type: "",
  service_type: "", employees_count: "",
  monthly_fee: "", monthly_ad_budget: "",
  contract_signed_date: "", contract_end_date: "",
  initial_revenue: "", business_goals: "",
  tax_id: "", id_number: "",
  instagram_handle: "", facebook_url: "", tiktok_handle: "",
  notes: "",
};

function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nextMeetings, setNextMeetings] = useState<Record<string, string>>({});
  const [planNames, setPlanNames] = useState<Record<string, string>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("id,name,phone,email,business_name,notes,assigned_to,plan_id,client_status,client_since,industry,initial_revenue,business_goals,service_type,city,created_at")
      .eq("stage", "לקוח פעיל")
      .order("created_at", { ascending: false });

    if (data) {
      setClients(data as unknown as Client[]);
      const today = new Date().toISOString().split("T")[0];
      const ids = data.map((c) => c.id);
      if (ids.length > 0) {
        const { data: mtgs } = await supabase
          .from("meetings")
          .select("contact_id, meeting_date")
          .in("contact_id", ids)
          .gte("meeting_date", today)
          .eq("status", "מתוכנן")
          .order("meeting_date", { ascending: true });
        if (mtgs) {
          const map: Record<string, string> = {};
          for (const m of mtgs) {
            if (m.contact_id && !map[m.contact_id]) map[m.contact_id] = m.meeting_date;
          }
          setNextMeetings(map);
        }
        const planIds = data.map((c) => c.plan_id).filter(Boolean) as string[];
        if (planIds.length > 0) {
          const { data: plans } = await supabase
            .from("plans")
            .select("id,name")
            .in("id", planIds);
          if (plans) {
            const pm: Record<string, string> = {};
            for (const p of plans) pm[p.id] = p.name;
            setPlanNames(pm);
          }
        }
      }
    }
    setLoading(false);
  }

  function f(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function createClient() {
    if (!form.name.trim()) return;
    setCreating(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("contacts").insert({
      name: form.name.trim(),
      business_name: form.business_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      city: form.city.trim() || null,
      website: form.website.trim() || null,
      industry: form.industry.trim() || null,
      business_type: form.business_type.trim() || null,
      service_type: form.service_type.trim() || null,
      employees_count: form.employees_count ? Number(form.employees_count) : null,
      monthly_fee: form.monthly_fee.trim() || null,
      monthly_ad_budget: form.monthly_ad_budget.trim() || null,
      contract_signed_date: form.contract_signed_date || null,
      contract_end_date: form.contract_end_date || null,
      initial_revenue: form.initial_revenue.trim() || null,
      business_goals: form.business_goals.trim() || null,
      tax_id: form.tax_id.trim() || null,
      id_number: form.id_number.trim() || null,
      instagram_handle: form.instagram_handle.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      tiktok_handle: form.tiktok_handle.trim() || null,
      notes: form.notes.trim() || null,
      stage: "לקוח פעיל",
      source: "ידני",
      client_status: "active",
      client_since: today,
    } as never);
    setCreating(false);
    if (error) { toast.error("שגיאה ביצירה"); return; }
    toast.success("לקוח נוצר");
    setShowCreate(false);
    setForm(EMPTY_FORM);
    void load();
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const ms = !q || c.name.toLowerCase().includes(q) || (c.business_name ?? "").toLowerCase().includes(q);
    const mf = statusFilter === "all" || (c.client_status ?? "active") === statusFilter;
    return ms && mf;
  });

  const counts = {
    all: clients.length,
    active: clients.filter((c) => (c.client_status ?? "active") === "active").length,
    paused: clients.filter((c) => c.client_status === "paused").length,
    ended:  clients.filter((c) => c.client_status === "ended").length,
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />
      <div className="min-h-screen px-7 py-6" style={{ direction: "rtl" }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">לקוחות</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{clients.length} לקוחות</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="ms-2 h-4 w-4" />
            לקוח חדש
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לקוח..."
              className="h-9 ps-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["all", "active", "paused", "ended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "הכל" : STATUS_CFG[s].label}
                <span className="ms-1.5 text-[10px] opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">אין לקוחות</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const st = (c.client_status ?? "active") as keyof typeof STATUS_CFG;
              const col = avatarColor(c.name);
              const nextMtg = nextMeetings[c.id];
              const planName = c.plan_id ? planNames[c.plan_id] : null;
              return (
                <button
                  key={c.id}
                  onClick={() => void navigate({ to: "/clients/$id", params: { id: c.id } })}
                  className="glass cursor-pointer rounded-2xl p-5 text-right transition-all hover:shadow-elevated"
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  <span
                    className="absolute inset-y-0 right-0 w-1 rounded-r-2xl"
                    style={{ backgroundColor: col }}
                  />
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow"
                      style={{ backgroundColor: col }}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-base font-semibold text-foreground">{c.name}</span>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_CFG[st]?.cls ?? "badge-primary")}>
                          {STATUS_CFG[st]?.label}
                        </span>
                      </div>
                      {c.business_name && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.business_name}</div>
                      )}
                    </div>
                  </div>

                  {(c.phone || c.email || c.service_type || c.industry || c.city) && (
                    <div className="mt-3 space-y-1.5">
                      {c.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span dir="ltr">{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {(c.service_type || c.industry) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span>{c.service_type ?? c.industry}</span>
                        </div>
                      )}
                      {c.city && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{c.city}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {c.client_since && <span>מ-{fmtDate(c.client_since)}</span>}
                      {planName && (
                        <span className="badge-primary rounded px-1.5 py-0.5 text-[10px]">{planName}</span>
                      )}
                    </div>
                    {nextMtg && (
                      <div className="flex items-center gap-1 text-[11px] text-primary">
                        <CalendarDays className="h-3 w-3" />
                        <span>{fmtDate(nextMtg)}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>לקוח חדש</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">

              {/* פרטי קשר */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">פרטי קשר</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">שם מלא *</label>
                    <Input value={form.name} onChange={f("name")} autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">שם עסק</label>
                    <Input value={form.business_name} onChange={f("business_name")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">טלפון</label>
                    <Input value={form.phone} onChange={f("phone")} dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">מייל</label>
                    <Input value={form.email} onChange={f("email")} dir="ltr" type="email" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">עיר</label>
                    <Input value={form.city} onChange={f("city")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">אתר אינטרנט</label>
                    <Input value={form.website} onChange={f("website")} dir="ltr" placeholder="https://..." />
                  </div>
                </div>
              </div>

              {/* פרטים עסקיים */}
              <div className="border-t border-border/50 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">פרטים עסקיים</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ענף עסקי</label>
                    <Input value={form.industry} onChange={f("industry")} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">סוג עסק</label>
                    <Input value={form.business_type} onChange={f("business_type")} placeholder="עוסק מורשה / חברה..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ח.פ / ע.מ</label>
                    <Input value={form.tax_id} onChange={f("tax_id")} dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ת.ז</label>
                    <Input value={form.id_number} onChange={f("id_number")} dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">מספר עובדים</label>
                    <Input value={form.employees_count} onChange={f("employees_count")} type="number" min="0" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">מחזור התחלתי</label>
                    <Input value={form.initial_revenue} onChange={f("initial_revenue")} placeholder="₪..." />
                  </div>
                </div>
              </div>

              {/* שירות וחוזה */}
              <div className="border-t border-border/50 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">שירות וחוזה</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">סוג שירות</label>
                    <Input value={form.service_type} onChange={f("service_type")} placeholder="ניהול שיווק / ייעוץ..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">עלות חודשית</label>
                    <Input value={form.monthly_fee} onChange={f("monthly_fee")} placeholder="₪..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">תקציב פרסום חודשי</label>
                    <Input value={form.monthly_ad_budget} onChange={f("monthly_ad_budget")} placeholder="₪..." />
                  </div>
                  <div />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">תאריך חתימת חוזה</label>
                    <Input value={form.contract_signed_date} onChange={f("contract_signed_date")} type="date" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">תאריך סיום חוזה</label>
                    <Input value={form.contract_end_date} onChange={f("contract_end_date")} type="date" />
                  </div>
                </div>
              </div>

              {/* רשתות חברתיות */}
              <div className="border-t border-border/50 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">רשתות חברתיות</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">אינסטגרם</label>
                    <Input value={form.instagram_handle} onChange={f("instagram_handle")} dir="ltr" placeholder="@handle" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">פייסבוק</label>
                    <Input value={form.facebook_url} onChange={f("facebook_url")} dir="ltr" placeholder="https://facebook.com/..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">טיקטוק</label>
                    <Input value={form.tiktok_handle} onChange={f("tiktok_handle")} dir="ltr" placeholder="@handle" />
                  </div>
                </div>
              </div>

              {/* נוסף */}
              <div className="border-t border-border/50 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">נוסף</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">מטרות עסקיות</label>
                    <Textarea value={form.business_goals} onChange={f("business_goals")} rows={2} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">הערות</label>
                    <Textarea value={form.notes} onChange={f("notes")} rows={2} />
                  </div>
                </div>
              </div>

            </div>

            <DialogFooter className="mt-2">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>ביטול</Button>
              <Button onClick={() => void createClient()} disabled={creating || !form.name.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "צור לקוח"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

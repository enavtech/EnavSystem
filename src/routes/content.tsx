import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin-session";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Film, Calendar, User, Link as LinkIcon,
  Pencil, Trash2, Loader2, ExternalLink, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/content")({
  component: ContentPage,
  head: () => ({ meta: [{ title: "תוכן — פרודקשן" }] }),
});

type ContentItem = {
  id: string;
  contact_id: string | null;
  plan_id: string | null;
  title: string;
  content_type: string;
  status: string;
  shoot_date: string | null;
  due_date: string | null;
  delivery_date: string | null;
  assigned_editor: string | null;
  notes: string | null;
  drive_link: string | null;
  position: number;
  created_at: string;
};

type Contact = { id: string; name: string; business_name: string | null };

const STATUSES = ["רעיון", "תסריט", "צילום", "עריכה", "בקרה", "הועלה"] as const;

const STATUS_COLORS: Record<string, string> = {
  "רעיון":   "bg-slate-100 text-slate-700",
  "תסריט":  "bg-blue-100 text-blue-800",
  "צילום":   "bg-amber-100 text-amber-800",
  "עריכה":   "bg-violet-100 text-violet-800",
  "בקרה":    "bg-orange-100 text-orange-800",
  "הועלה":   "bg-green-100 text-green-800",
};

const STATUS_DOT: Record<string, string> = {
  "רעיון":   "bg-slate-400",
  "תסריט":  "bg-blue-500",
  "צילום":   "bg-amber-500",
  "עריכה":   "bg-violet-500",
  "בקרה":    "bg-orange-500",
  "הועלה":   "bg-green-500",
};

const CONTENT_TYPES = ["רילס", "טיקטוק", "סטורי", "יוטיוב", "פוסט"];

const TYPE_COLORS: Record<string, string> = {
  "רילס":    "bg-pink-100 text-pink-800",
  "טיקטוק": "bg-slate-100 text-slate-800",
  "סטורי":   "bg-blue-100 text-blue-700",
  "יוטיוב":  "bg-red-100 text-red-800",
  "פוסט":    "bg-indigo-100 text-indigo-800",
};

const TEAM_MEMBERS = ["ענב", "אוריאל", "דניאל"];

const EMPTY_FORM = {
  title: "", content_type: "רילס", status: "רעיון",
  contact_id: "", shoot_date: "", due_date: "", delivery_date: "",
  assigned_editor: "", notes: "", drive_link: "",
};

function ContentPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dragId, setDragId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("הכל");
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    if (!isAdmin()) { navigate({ to: "/login" }); return; }
    void load();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const [{ data: contentData }, { data: contactData }] = await Promise.all([
      supabase.from("content_items").select("*").order("position"),
      supabase.from("contacts").select("id,name,business_name").order("name"),
    ]);
    setItems((contentData ?? []) as ContentItem[]);
    setContacts((contactData ?? []) as Contact[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (filterType === "הכל") return items;
    return items.filter((i) => i.content_type === filterType);
  }, [items, filterType]);

  const grouped = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    STATUSES.forEach((s) => { map[s] = []; });
    filtered.forEach((item) => {
      if (map[item.status]) map[item.status].push(item);
      else map["רעיון"].push(item);
    });
    return map;
  }, [filtered]);

  const contactMap = useMemo(() => {
    const m: Record<string, Contact> = {};
    contacts.forEach((c) => { m[c.id] = c; });
    return m;
  }, [contacts]);

  async function save() {
    if (!form.title.trim()) { toast.error("חובה כותרת"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      content_type: form.content_type,
      status: form.status,
      contact_id: form.contact_id || null,
      shoot_date: form.shoot_date || null,
      due_date: form.due_date || null,
      delivery_date: form.delivery_date || null,
      assigned_editor: form.assigned_editor || null,
      notes: form.notes.trim() || null,
      drive_link: form.drive_link.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      const { error } = await supabase.from("content_items").update(payload).eq("id", editItem.id);
      if (error) { toast.error(error.message); } else { toast.success("עודכן"); }
    } else {
      const maxPos = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
      const { error } = await supabase.from("content_items").insert({ ...payload, position: maxPos });
      if (error) { toast.error(error.message); } else { toast.success("נוצר פריט תוכן"); }
    }
    setSaving(false);
    setShowAdd(false);
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    void load();
  }

  async function deleteItem(id: string) {
    if (!confirm("למחוק?")) return;
    await supabase.from("content_items").delete().eq("id", id);
    setDetailItem(null);
    void load();
  }

  async function moveStatus(id: string, status: string) {
    await supabase.from("content_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function handleColumnDrop(status: string) {
    if (!dragId) return;
    await moveStatus(dragId, status);
    setDragId(null);
  }

  function openEdit(item: ContentItem) {
    setForm({
      title: item.title,
      content_type: item.content_type,
      status: item.status,
      contact_id: item.contact_id ?? "",
      shoot_date: item.shoot_date ?? "",
      due_date: item.due_date ?? "",
      delivery_date: item.delivery_date ?? "",
      assigned_editor: item.assigned_editor ?? "",
      notes: item.notes ?? "",
      drive_link: item.drive_link ?? "",
    });
    setEditItem(item);
    setShowAdd(true);
    setDetailItem(null);
  }

  if (loading) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <Toaster position="top-center" dir="rtl" />

      {/* Header */}
      <div className="border-b border-border bg-white px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">תוכן — פרודקשן</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">צינור ייצור תוכן — מרעיון ועד העלאה</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status totals */}
            <div className="hidden items-center gap-4 md:flex">
              {STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                  <span>{s}</span>
                  <span className="font-bold text-foreground">{grouped[s]?.length ?? 0}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => { setForm({ ...EMPTY_FORM }); setEditItem(null); setShowAdd(true); }}>
              <Plus className="ms-2 h-4 w-4" />
              פריט חדש
            </Button>
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div className="border-b border-border bg-white px-7 py-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["הכל", ...CONTENT_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                filterType === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t} {t !== "הכל" && `(${items.filter((i) => i.content_type === t).length})`}
            </button>
          ))}
          <div className="me-auto text-sm text-muted-foreground">
            {filtered.length} פריטים
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto px-5 py-5">
        <div className="flex min-w-max gap-3.5">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="flex w-60 flex-shrink-0 flex-col rounded-2xl border border-border bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleColumnDrop(status)}
            >
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
                  <span className="text-sm font-semibold text-foreground">{status}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {grouped[status]?.length ?? 0}
                  </span>
                </div>
                <button
                  onClick={() => { setForm({ ...EMPTY_FORM, status }); setEditItem(null); setShowAdd(true); }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {(grouped[status] ?? []).map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setDetailItem(item)}
                    className={cn(
                      "cursor-pointer rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/30 hover:shadow-md",
                      dragId === item.id && "opacity-40"
                    )}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0", TYPE_COLORS[item.content_type])}>
                        {item.content_type}
                      </span>
                      {item.drive_link && (
                        <a
                          href={item.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                    {item.contact_id && contactMap[item.contact_id] && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {contactMap[item.contact_id]!.name}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {item.shoot_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.shoot_date).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {item.assigned_editor && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.assigned_editor}
                        </span>
                      )}
                      {item.due_date && (
                        <span className={cn(
                          "flex items-center gap-1",
                          new Date(item.due_date) < new Date() && item.status !== "הועלה" && "text-destructive"
                        )}>
                          ⏱ {new Date(item.due_date).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(grouped[status] ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    גרור לכאן
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "עריכת פריט תוכן" : "פריט תוכן חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">כותרת *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="שם הסרטון / פוסט" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">סוג</label>
                <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">שלב</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">עורך</label>
                <Select value={form.assigned_editor || "_none"} onValueChange={(v) => setForm({ ...form, assigned_editor: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {TEAM_MEMBERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">לקוח (אופציונלי)</label>
              <Select value={form.contact_id || "_none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— בחר לקוח —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— ללא —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.business_name ? ` · ${c.business_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">יום צילום</label>
                <Input type="date" value={form.shoot_date} onChange={(e) => setForm({ ...form, shoot_date: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">דדליין</label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">תאריך העלאה</label>
                <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">קישור Drive</label>
              <Input value={form.drive_link} onChange={(e) => setForm({ ...form, drive_link: e.target.value })} placeholder="https://drive.google.com/..." dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">הערות</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="הערות..." className="min-h-[70px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>ביטול</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {editItem ? "עדכן" : "צור פריט"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail panel */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" onClick={() => setDetailItem(null)}>
          <div
            className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TYPE_COLORS[detailItem.content_type])}>
                    {detailItem.content_type}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_COLORS[detailItem.status])}>
                    {detailItem.status}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold text-foreground">{detailItem.title}</h2>
              </div>
              <button onClick={() => setDetailItem(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Stage selector */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">שלב בפרודקשן</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => void moveStatus(detailItem.id, s).then(() => setDetailItem({ ...detailItem, status: s }))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                        detailItem.status === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 rounded-xl border border-border p-3">
                {detailItem.contact_id && contactMap[detailItem.contact_id] && (
                  <DetailRow icon={<Film className="h-3.5 w-3.5" />} label="לקוח">
                    {contactMap[detailItem.contact_id]!.name}
                  </DetailRow>
                )}
                {detailItem.assigned_editor && (
                  <DetailRow icon={<User className="h-3.5 w-3.5" />} label="עורך">
                    {detailItem.assigned_editor}
                  </DetailRow>
                )}
                {detailItem.shoot_date && (
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="צילום">
                    {new Date(detailItem.shoot_date).toLocaleDateString("he-IL")}
                  </DetailRow>
                )}
                {detailItem.due_date && (
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="דדליין">
                    <span className={cn(
                      new Date(detailItem.due_date) < new Date() && detailItem.status !== "הועלה"
                        ? "text-destructive" : "text-foreground"
                    )}>
                      {new Date(detailItem.due_date).toLocaleDateString("he-IL")}
                    </span>
                  </DetailRow>
                )}
                {detailItem.delivery_date && (
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="העלאה">
                    {new Date(detailItem.delivery_date).toLocaleDateString("he-IL")}
                  </DetailRow>
                )}
                {detailItem.drive_link && (
                  <DetailRow icon={<LinkIcon className="h-3.5 w-3.5" />} label="Drive">
                    <a
                      href={detailItem.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      פתח קובץ
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </DetailRow>
                )}
              </div>

              {detailItem.notes && (
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">הערות</div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{detailItem.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border px-5 py-4">
              <Button size="sm" variant="outline" onClick={() => openEdit(detailItem)}>
                <Pencil className="ms-1.5 h-3.5 w-3.5" />
                עריכה
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void deleteItem(detailItem.id)}
              >
                <Trash2 className="ms-1.5 h-3.5 w-3.5" />
                מחיקה
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="w-16 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

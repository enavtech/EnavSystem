export const DEPARTMENT_COLORS: Record<string, string> = {
  "פיננסים": "oklch(0.5 0.13 280)",
  "משפטי/סיכונים": "oklch(0.55 0.18 25)",
  "התנהלות": "oklch(0.5 0.12 160)",
  "מערכות": "oklch(0.5 0.13 230)",
  "מכירות": "oklch(0.55 0.13 70)",
  "שיווק": "oklch(0.5 0.14 130)",
};

export const PRIORITY_ORDER: Record<string, number> = {
  "דחופה": 0,
  "גבוהה": 1,
  "בינונית": 2,
  "נמוכה": 3,
};

export const PRIORITIES = ["דחופה", "גבוהה", "בינונית", "נמוכה"] as const;
export const STATUSES = ["לא התחיל", "בתהליך", "מעוכב", "הושלם"] as const;
export const DEPARTMENTS = [
  "פיננסים",
  "משפטי/סיכונים",
  "התנהלות",
  "מערכות",
  "מכירות",
  "שיווק",
] as const;

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  "לא התחיל": "#94a3b8",
  "בתהליך": "#f59e0b",
  "מעוכב": "#dc2626",
  "הושלם": "#16a34a",
};

/** Curated palette for color pickers (members, plans, statuses). */
export const COLOR_PALETTE: string[] = [
  "#2563eb", "#0ea5e9", "#06b6d4", "#10b981", "#16a34a",
  "#84cc16", "#eab308", "#f59e0b", "#f97316", "#dc2626",
  "#ec4899", "#a855f7", "#8b5cf6", "#6366f1", "#475569",
  "#0f172a",
];

export function getStatusColor(
  status: string,
  statusColors?: Record<string, string> | null
): string {
  return (statusColors?.[status]) ?? DEFAULT_STATUS_COLORS[status] ?? "#94a3b8";
}

/** Returns true when a hex color is light enough that white text won't read well. */
export function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Perceived brightness (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 170;
}

/** Returns the best foreground color (white/dark) for a given hex background. */
export function readableTextOn(hex: string): string {
  return isLightColor(hex) ? "#0f172a" : "#ffffff";
}

export function getDepartmentColor(dept: string | null | undefined): string {
  if (!dept) return "oklch(0.5 0.03 250)";
  return DEPARTMENT_COLORS[dept] ?? "oklch(0.5 0.03 250)";
}

export function calcDays(deadline: string | null): number | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function priorityBadgeClass(p: string): string {
  switch (p) {
    case "דחופה":
      return "bg-urgent/15 text-urgent border-urgent/25";
    case "גבוהה":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "בינונית":
      return "bg-accent text-accent-foreground border-accent/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function statusBadgeClass(s: string): string {
  switch (s) {
    case "הושלם":
      return "bg-success/15 text-success border-success/25";
    case "בתהליך":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "מעוכב":
      return "bg-urgent/10 text-urgent border-urgent/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function generateSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : suffix;
}

export function getAuthorName(): string {
  if (typeof window === "undefined") return "אורח";
  return localStorage.getItem("plan_author_name") || "אורח";
}

export function setAuthorName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("plan_author_name", name.trim() || "אורח");
}

export type ParsedTask = {
  title: string;
  department: string | null;
  priority: string;
  status: string;
  deadline: string | null;
  note: string | null;
  steps: string[];
};

export type ParsedPlan = {
  name: string;
  subtitle: string | null;
  tasks: ParsedTask[];
};

function normalizePriority(v: unknown): string {
  const s = String(v ?? "").trim();
  return (PRIORITIES as readonly string[]).includes(s) ? s : "בינונית";
}

function normalizeStatus(v: unknown): string {
  const s = String(v ?? "").trim();
  return (STATUSES as readonly string[]).includes(s) ? s : "לא התחיל";
}

function normalizeDepartment(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return (DEPARTMENTS as readonly string[]).includes(s) ? s : s;
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy or dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toIsoDate(d);
  return null;
}

function parseSteps(v: unknown): string[] {
  if (!v) return [];
  return String(v)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)\-]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Parses an array of arrays (sheet rows) into a plan + tasks.
 * Expects header row containing: מחלקה, משימה ראשית, יעד מדיד, תתי-משימות, עדיפות, דדליין, סטטוס, הערות
 */
export function parseSheetRows(rows: unknown[][]): ParsedPlan {
  let name = "תוכנית מיובאת";
  let subtitle: string | null = null;
  let headerIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] ?? [];
    const joined = row.map((c) => String(c ?? "")).join("|");
    if (joined.includes("מחלקה") && joined.includes("משימה")) {
      headerIdx = i;
      break;
    }
    const first = String(row[0] ?? "").trim();
    if (i === 0 && first) name = first;
    else if (i === 1 && first && !subtitle) subtitle = first;
  }
  if (headerIdx === -1) return { name, subtitle, tasks: [] };

  const header = (rows[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const idx = (label: string) => header.findIndex((h) => h.includes(label));
  const cDept = idx("מחלקה");
  const cTitle = idx("משימה");
  const cGoal = idx("יעד");
  const cSteps = idx("תתי");
  const cPrio = idx("עדיפות");
  const cDead = idx("דדליין");
  const cStat = idx("סטטוס");
  const cNote = idx("הערות");

  const tasks: ParsedTask[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const title = String(row[cTitle] ?? "").trim();
    if (!title) continue;
    const goal = cGoal >= 0 ? String(row[cGoal] ?? "").trim() : "";
    const noteVal = cNote >= 0 ? String(row[cNote] ?? "").trim() : "";
    const noteParts = [goal && `יעד: ${goal}`, noteVal].filter(Boolean);
    tasks.push({
      title,
      department: cDept >= 0 ? normalizeDepartment(row[cDept]) : null,
      priority: cPrio >= 0 ? normalizePriority(row[cPrio]) : "בינונית",
      status: cStat >= 0 ? normalizeStatus(row[cStat]) : "לא התחיל",
      deadline: cDead >= 0 ? toIsoDate(row[cDead]) : null,
      note: noteParts.join("\n\n") || null,
      steps: cSteps >= 0 ? parseSteps(row[cSteps]) : [],
    });
  }
  return { name, subtitle, tasks };
}
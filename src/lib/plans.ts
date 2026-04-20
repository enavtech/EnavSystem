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
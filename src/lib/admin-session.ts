// Admin session token stored in localStorage for client gating
// (server side validates the password and returns a signed token)

const KEY = "plan_admin_token_v1";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setAdminToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function isAdmin(): boolean {
  return !!getAdminToken();
}
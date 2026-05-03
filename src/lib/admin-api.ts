import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "node:crypto";

// ─── HMAC token helpers ────────────────────────────────────────────────────

function signingSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback-dev-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

function makeToken(): string {
  const issued = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = `${issued}.${nonce}`;
  return `${body}.${sign(body)}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issued, nonce, sig] = parts;
  const expected = sign(`${issued}.${nonce}`);
  if (sig !== expected) return false;
  const issuedMs = Number(issued);
  if (!Number.isFinite(issuedMs)) return false;
  if (Date.now() - issuedMs > 30 * 24 * 60 * 60 * 1000) return false;
  return true;
}

// ─── Supabase Auth for primary admin ──────────────────────────────────────

// Internal email used for the single primary admin in Supabase Auth.
// Real email is not required; this is just an Auth identifier.
const PRIMARY_ADMIN_EMAIL = "admin@system.local";

async function ensurePrimaryAuthUser(): Promise<void> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const exists = data.users.some((u) => u.email === PRIMARY_ADMIN_EMAIL);
  if (!exists) {
    await supabaseAdmin.auth.admin.createUser({
      email: PRIMARY_ADMIN_EMAIL,
      password: crypto.randomBytes(32).toString("hex"), // random — never used directly
      email_confirm: true,
      user_metadata: { role: "admin", name: "מנהל ראשי", is_primary: true },
    });
  }
}

// Returns a one-time OTP the client uses to create a Supabase Auth session.
// Magic links are generated server-side and NOT emailed (admin API, silent).
async function generateAdminOtp(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: PRIMARY_ADMIN_EMAIL,
  });
  if (error) {
    console.error("generateLink error:", error.message);
    return null;
  }
  return (data as { properties?: { email_otp?: string } }).properties?.email_otp ?? null;
}

// ─── Server functions ──────────────────────────────────────────────────────

/** Get whether the admin password has been initialized */
export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("admin_password_hash")
    .eq("id", 1)
    .maybeSingle();
  return { hasPassword: !!data?.admin_password_hash };
});

/** First-time setup: set the admin password */
export const setupAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => {
    if (!d || typeof d.password !== "string" || d.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    if (d.password.length > 200) throw new Error("Password too long");
    return { password: d.password };
  })
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (existing?.admin_password_hash) throw new Error("Password already set");

    const hash = await bcrypt.hash(data.password, 10);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ admin_password_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);

    // Create Supabase Auth user for primary admin (silently)
    await ensurePrimaryAuthUser();
    const emailOtp = await generateAdminOtp();

    return { token: makeToken(), authEmail: PRIMARY_ADMIN_EMAIL, emailOtp };
  });

/** Login with admin password */
export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => {
    if (!d || typeof d.password !== "string" || d.password.length < 1)
      throw new Error("Missing password");
    if (d.password.length > 200) throw new Error("Invalid password");
    return { password: d.password };
  })
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (!row?.admin_password_hash) throw new Error("Admin password not set");

    const ok = await bcrypt.compare(data.password, row.admin_password_hash);
    if (!ok) throw new Error("Incorrect password");

    // Ensure primary auth user exists and generate one-time OTP for Supabase Auth
    await ensurePrimaryAuthUser();
    const emailOtp = await generateAdminOtp();

    return { token: makeToken(), authEmail: PRIMARY_ADMIN_EMAIL, emailOtp };
  });

/** Verify a token (server-side check) */
export const verifyAdminTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ({ token: String(d?.token ?? "") }))
  .handler(async ({ data }) => ({ valid: verifyAdminToken(data.token) }));

// ─── Team members sync helpers ────────────────────────────────────────────

const MEMBER_COLORS = [
  "#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#db2777", "#ea580c", "#65a30d", "#0284c7",
];

async function upsertTeamMember(id: string, name: string, colorIndex: number) {
  await supabaseAdmin.from("team_members").upsert(
    { id, name, color: MEMBER_COLORS[colorIndex % MEMBER_COLORS.length], active: true },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

// ─── Multi-admin management ────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "consultant" | "viewer";
  is_primary: boolean;
  created_at: string;
};

/** List all admin users (from Supabase Auth) */
export const listAdminUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  return data.users.map(
    (u): AdminUser => ({
      id: u.id,
      email: u.email ?? "",
      name: String(u.user_metadata?.name ?? u.email ?? ""),
      role: (u.user_metadata?.role as AdminUser["role"]) ?? "viewer",
      is_primary: u.user_metadata?.is_primary === true,
      created_at: u.created_at,
    })
  );
});

/** Create a new admin user */
export const createAdminUser = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; name: string; role: string; password: string }) => {
      if (!d.email || !d.password) throw new Error("Missing fields");
      if (d.password.length < 6) throw new Error("Password too short");
      return d;
    }
  )
  .handler(async ({ data }) => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: data.role, name: data.name },
    });
    if (error) throw new Error(error.message);
    const { count } = await supabaseAdmin
      .from("team_members").select("*", { count: "exact", head: true });
    await upsertTeamMember(created.user.id, data.name || data.email, count ?? 0);
    return { success: true };
  });

/** Update an admin user's role */
export const updateAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; role: string; name: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { role: data.role, name: data.name },
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("team_members").update({ name: data.name }).eq("id", data.userId);
    return { success: true };
  });

/** Delete an admin user (cannot delete primary) */
export const deleteAdminUser = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (user.user?.user_metadata?.is_primary) throw new Error("Cannot delete primary admin");
    await supabaseAdmin.from("team_members").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/**
 * After a secondary admin signs in with Supabase Auth,
 * they call this to get an HMAC token (for isAdmin() UI gate).
 * We verify the access token server-side before issuing.
 */
export const loginAdminBySession = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => ({ accessToken: String(d?.accessToken ?? "") }))
  .handler(async ({ data }) => {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !user) throw new Error("Invalid session");
    const role = user.user_metadata?.role as string | undefined;
    if (!role) throw new Error("Not an admin user");
    return { token: makeToken(), role };
  });

/** Sync team_members table from Supabase Auth users (idempotent, won't override existing colors) */
export const syncTeamMembers = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  let i = 0;
  for (const u of data.users) {
    const name = String(u.user_metadata?.name ?? u.email ?? "");
    await upsertTeamMember(u.id, name, i);
    i++;
  }
  return { synced: data.users.length };
});

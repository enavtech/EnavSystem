import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "node:crypto";

// Stable signing secret derived from service role key (never sent to client)
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
  // 30-day expiry
  const issuedMs = Number(issued);
  if (!Number.isFinite(issuedMs)) return false;
  if (Date.now() - issuedMs > 30 * 24 * 60 * 60 * 1000) return false;
  return true;
}

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
    if (!d || typeof d.password !== "string" || d.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (d.password.length > 200) throw new Error("Password too long");
    return { password: d.password };
  })
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (existing?.admin_password_hash) {
      throw new Error("Password already set");
    }
    const hash = await bcrypt.hash(data.password, 10);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ admin_password_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { token: makeToken() };
  });

/** Login with admin password */
export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => {
    if (!d || typeof d.password !== "string" || d.password.length < 1) {
      throw new Error("Missing password");
    }
    if (d.password.length > 200) throw new Error("Invalid password");
    return { password: d.password };
  })
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (!row?.admin_password_hash) {
      throw new Error("Admin password not set");
    }
    const ok = await bcrypt.compare(data.password, row.admin_password_hash);
    if (!ok) throw new Error("Incorrect password");
    return { token: makeToken() };
  });

/** Verify a token still valid (server-side check on demand) */
export const verifyAdminTokenFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => ({ token: String(d?.token ?? "") }))
  .handler(async ({ data }) => {
    return { valid: verifyAdminToken(data.token) };
  });
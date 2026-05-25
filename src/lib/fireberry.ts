// Fireberry API HTTP client — SERVER SIDE ONLY
// Never import this in client components.
// Token is read from process.env.FIREBERRY_TOKEN_ID

const BASE = "https://api.fireberry.com/api";

function getHeaders(): Record<string, string> {
  const token = process.env.FIREBERRY_TOKEN_ID;
  if (!token || token === "PASTE-YOUR-TOKEN-HERE") {
    throw new Error("FIREBERRY_TOKEN_ID is not configured in .env");
  }
  return {
    tokenid: token,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

async function handleResponse<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fireberry ${label} → HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function wrapFetchError(e: unknown, label: string): never {
  if (e instanceof TypeError && (e as NodeJS.ErrnoException).cause) {
    const cause = (e as NodeJS.ErrnoException).cause as Error;
    throw new Error(`Fireberry ${label} → Network error: ${cause?.message ?? String(cause)}`);
  }
  throw e;
}

export async function fbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders() }).catch(e => wrapFetchError(e, `GET ${path}`));
  return handleResponse<T>(res, `GET ${path}`);
}

export async function fbPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  }).catch(e => wrapFetchError(e, `POST ${path}`));
  return handleResponse<T>(res, `POST ${path}`);
}

export async function fbPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, `PUT ${path}`);
}

export async function fbDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fireberry DELETE ${path} → HTTP ${res.status}: ${text}`);
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FbQueryField {
  name: string;
  alias?: string;
  aggrFunc?: "SUM" | "COUNT" | "MIN" | "MAX";
}

export interface FbQueryCondition {
  fieldName: string;
  operator:
    | "eq" | "ne"
    | "lt" | "gt" | "le" | "ge"
    | "start-with" | "not-start-with"
    | "is-null" | "is-not-null"
    | "eq-in" | "not-in"
    | "between";
  value?: unknown;
}

export interface FbQueryFilter {
  type: "AND" | "OR";
  conditions: FbQueryCondition[];
}

export interface FbQueryOptions {
  objectType: number | string;
  fields: FbQueryField[];
  filter?: FbQueryFilter[];
  orderBy?: { name: string; order: "asc" | "desc" }[];
  pageNumber?: number;
  pageSize?: number;
}

export interface FbQueryResponse<T> {
  data: T[];
  success: boolean;
  message: string;
  pageNumber: number;
  pageSize: number;
  isLastPage: boolean;
}

// ─── v3 Query helper ────────────────────────────────────────────────────────

export async function fbQuery<T>(opts: FbQueryOptions): Promise<FbQueryResponse<T>> {
  return fbPost<FbQueryResponse<T>>("/v3/query", {
    ...opts,
    pageNumber: opts.pageNumber ?? 1,
    pageSize: opts.pageSize ?? 50,
  });
}

// ─── Single record helpers ──────────────────────────────────────────────────

export async function fbGetRecord<T>(objectType: string | number, id: string): Promise<T> {
  // Fireberry single-record GET returns { success, data: { Record: {...} } }
  const res = await fbGet<{ data: { Record: T }; success: boolean }>(`/record/${objectType}/${id}`);
  return res.data.Record;
}

export async function fbCreateRecord<T>(objectType: string | number, body: Record<string, unknown>): Promise<T> {
  const res = await fbPost<{ data: T; success: boolean }>(`/record/${objectType}`, body);
  return res.data;
}

export async function fbUpdateRecord(objectType: string | number, id: string, body: Record<string, unknown>): Promise<void> {
  await fbPut(`/record/${objectType}/${id}`, body);
}

export async function fbDeleteRecord(objectType: string | number, id: string): Promise<void> {
  await fbDelete(`/record/${objectType}/${id}`);
}

// ─── JSON-safe type for metadata responses ──────────────────────────────────

export type FbJson =
  | string
  | number
  | boolean
  | null
  | FbJson[]
  | { [key: string]: FbJson };

// ─── Metadata helpers ───────────────────────────────────────────────────────

export async function fbGetObjectTypes(): Promise<FbJson> {
  return fbGet<FbJson>("/metadata/records");
}

export async function fbGetFields(objectType: string | number): Promise<FbJson> {
  return fbGet<FbJson>(`/metadata/records/${objectType}/fields`);
}

export async function fbGetFieldValues(objectType: string | number, fieldName: string): Promise<FbJson> {
  return fbGet<FbJson>(`/metadata/records/${objectType}/fields/${fieldName}/values`);
}

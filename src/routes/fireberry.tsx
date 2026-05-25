import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fbDiscover, fbGetRecordRaw } from "@/lib/fireberry-api";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/fireberry")({
  component: FireberryDiscovery,
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Fireberry Discovery" }] }),
});

function flatten(obj: unknown, prefix = ""): [string, string][] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== "object" || Array.isArray(obj)) {
    return [[prefix, String(obj)]];
  }
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && v !== undefined && v !== "") {
      if (typeof v === "object" && !Array.isArray(v)) {
        entries.push(...flatten(v, key));
      } else {
        entries.push([key, String(v)]);
      }
    }
  }
  return entries;
}

function FireberryDiscovery() {
  const { id } = useSearch({ from: "/fireberry" });
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<{ code: number; name: string; count: number }[]>([]);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void run(); }, [id]);

  async function run() {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    try {
      if (id) {
        const raw = await fbGetRecordRaw({ data: { id } });
        setRawResponse(raw);
      } else {
        const result = await fbDiscover();
        const d = result as { stages: typeof stages; fullRecord: unknown; error: string | null };
        if (d.error) { setError(d.error); return; }
        setStages(d.stages ?? []);
        setRawResponse(d.fullRecord);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  const flatFields = rawResponse ? flatten(rawResponse) : [];

  return (
    <AppShell>
      <div className="min-h-screen p-6 font-mono text-sm" style={{ direction: "ltr" }}>
        <h1 className="mb-2 text-xl font-bold">Fireberry — Field Discovery</h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Add <code>?id=GUID</code> to the URL to inspect a specific record.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-xs mb-4">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {stages.length > 0 && (
              <div>
                <h2 className="mb-3 font-bold">Stages</h2>
                <table className="border-collapse text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-8">statuscode</th>
                      <th className="pb-2 pr-8">name</th>
                      <th className="pb-2">records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map(s => (
                      <tr key={s.code} className="border-b last:border-0">
                        <td className="py-1.5 pr-8 font-bold text-blue-600">{s.code}</td>
                        <td className="py-1.5 pr-8">{s.name}</td>
                        <td className="py-1.5 text-muted-foreground">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {flatFields.length > 0 && (
              <div>
                <h2 className="mb-3 font-bold">
                  All fields with values {id ? `(record: ${id.slice(0, 8)}…)` : "(first record)"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — {flatFields.length} fields
                  </span>
                </h2>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-8">field name</th>
                      <th className="pb-2">value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatFields.map(([k, v]) => (
                      <tr key={k} className="border-b last:border-0">
                        <td className="py-1.5 pr-8 text-blue-600 font-medium whitespace-nowrap">{k}</td>
                        <td className="py-1.5 text-muted-foreground break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rawResponse !== null && flatFields.length === 0 && (
              <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

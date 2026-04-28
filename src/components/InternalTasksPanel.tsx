import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Briefcase, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ColorPicker } from "@/components/ColorPicker";
import { toast } from "sonner";

type InternalTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
};
type Member = { id: string; name: string; color: string | null };

const STATUSES = [
  { id: "todo", label: "להתחיל" },
  { id: "in_progress", label: "בתהליך" },
  { id: "blocked", label: "חסום" },
  { id: "done", label: "הושלם" },
];

interface Props {
  clientTaskId: string;
  planId: string;
}

export function InternalTasksPanel({ clientTaskId, planId }: Props) {
  const [items, setItems] = useState<InternalTask[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("none");

  async function load() {
    const [a, b] = await Promise.all([
      supabase
        .from("internal_tasks")
        .select("id,title,status,priority,assignee_id,due_date")
        .eq("client_task_id", clientTaskId)
        .order("created_at"),
      supabase.from("team_members").select("id,name,color").order("name"),
    ]);
    setItems((a.data ?? []) as InternalTask[]);
    setMembers((b.data ?? []) as Member[]);
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`internal-${clientTaskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_tasks",
          filter: `client_task_id=eq.${clientTaskId}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientTaskId]);

  async function add() {
    if (!newTitle.trim()) return;
    await supabase.from("internal_tasks").insert({
      title: newTitle.trim(),
      client_task_id: clientTaskId,
      plan_id: planId,
      assignee_id: newAssignee === "none" ? null : newAssignee,
      status: "todo",
      priority: "medium",
    });
    setNewTitle("");
    setNewAssignee("none");
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("internal_tasks").update({ status }).eq("id", id);
  }
  async function setAssignee(id: string, assignee_id: string) {
    await supabase
      .from("internal_tasks")
      .update({ assignee_id: assignee_id === "none" ? null : assignee_id })
      .eq("id", id);
  }
  async function remove(id: string) {
    await supabase.from("internal_tasks").delete().eq("id", id);
  }

  async function updateMemberColor(memberId: string, color: string) {
    const { error } = await supabase
      .from("team_members")
      .update({ color })
      .eq("id", memberId);
    if (error) toast.error(error.message);
  }

  const open = items.filter((i) => i.status !== "done").length;

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
          <Briefcase className="h-3 w-3" />
          משימות צוות פנימיות (רק אדמין) · {open} פתוחות
        </div>
        <Link to="/team" className="text-[11px] text-primary hover:underline">
          לוח צוות מלא ←
        </Link>
      </div>

      {members.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-md bg-card/60 px-2 py-1.5">
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Palette className="h-3 w-3" /> צבעי צוות
          </span>
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: (m.color ?? "#64748b") + "18",
                borderColor: (m.color ?? "#64748b") + "55",
              }}
            >
              <ColorPicker
                value={m.color ?? "#64748b"}
                onChange={(c) => updateMemberColor(m.id, c)}
                size="sm"
                className="!border-0 !bg-transparent !p-0"
              />
              <span style={{ color: m.color ?? "#0f172a" }}>{m.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((t) => {
          const assignee = t.assignee_id
            ? members.find((m) => m.id === t.assignee_id)
            : undefined;
          const aColor = assignee?.color ?? "#64748b";
          return (
          <div
            key={t.id}
            className="group flex flex-wrap items-center gap-1.5 rounded-md bg-card px-2 py-1.5 text-xs"
            style={
              assignee
                ? {
                    borderInlineStartWidth: 3,
                    borderInlineStartStyle: "solid",
                    borderInlineStartColor: aColor,
                  }
                : undefined
            }
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                t.status === "done" && "text-muted-foreground line-through"
              )}
            >
              {t.title}
            </span>
            {assignee && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: aColor + "22",
                  color: aColor,
                  border: `1px solid ${aColor}55`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: aColor }}
                />
                {assignee.name}
              </span>
            )}
            <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
              <SelectTrigger className="h-6 w-[100px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={t.assignee_id ?? "none"}
              onValueChange={(v) => setAssignee(t.id, v)}
            >
              <SelectTrigger className="h-6 w-[110px] text-[11px]">
                <SelectValue placeholder="ללא" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: m.color ?? "#64748b" }}
                      />
                      {m.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => remove(t.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="הוסף משימה פנימית לצוות…"
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Select value={newAssignee} onValueChange={setNewAssignee}>
          <SelectTrigger className="h-7 w-[110px] text-[11px]">
            <SelectValue placeholder="ללא" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">ללא שיוך</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.color ?? "#64748b" }}
                  />
                  {m.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

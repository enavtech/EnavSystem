import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskStep, Comment } from "@/hooks/usePlanRealtime";
import {
  calcDays,
  formatDeadline,
  getDepartmentColor,
  priorityBadgeClass,
  getStatusColor,
  readableTextOn,
  PRIORITIES,
  STATUSES,
  DEPARTMENTS,
  getAuthorName,
} from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Trash2, Plus, MessageSquare, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InternalTasksPanel } from "@/components/InternalTasksPanel";

interface Props {
  task: Task;
  steps: TaskStep[];
  comments: Comment[];
  isAdminView?: boolean;
  planId?: string;
  /** Per-plan status color overrides. */
  statusColors?: Record<string, string> | null;
}

export function TaskCard({ task, steps, comments, isAdminView, planId, statusColors }: Props) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const [editingNote, setEditingNote] = useState(task.note ?? "");
  const [newStep, setNewStep] = useState("");
  const [newComment, setNewComment] = useState("");

  const days = calcDays(task.deadline);
  const isDone = task.status === "הושלם";
  const isProg = task.status === "בתהליך";

  const statusColor = getStatusColor(task.status, statusColors);
  const statusFg = readableTextOn(statusColor);

  async function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    const newStatus = isDone ? "לא התחיל" : "הושלם";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  }

  async function updateField(patch: Partial<Task>) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    if (error) toast.error("שגיאה בעדכון");
  }

  async function saveTitleNote() {
    await supabase
      .from("tasks")
      .update({ title: editingTitle, note: editingNote || null })
      .eq("id", task.id);
    toast.success("נשמר");
  }

  async function deleteTask() {
    if (!confirm(`למחוק את המשימה "${task.title}"?`)) return;
    await supabase.from("tasks").delete().eq("id", task.id);
  }

  async function toggleStep(step: TaskStep) {
    await supabase.from("task_steps").update({ done: !step.done }).eq("id", step.id);
  }

  async function deleteStep(id: string) {
    await supabase.from("task_steps").delete().eq("id", id);
  }

  async function updateStepContent(id: string, content: string) {
    await supabase.from("task_steps").update({ content }).eq("id", id);
  }

  async function addStep() {
    if (!newStep.trim()) return;
    const pos = steps.length;
    await supabase
      .from("task_steps")
      .insert({ task_id: task.id, content: newStep.trim(), position: pos });
    setNewStep("");
  }

  async function addComment() {
    if (!newComment.trim()) return;
    await supabase.from("comments").insert({
      task_id: task.id,
      author_name: getAuthorName(),
      body: newComment.trim(),
    });
    setNewComment("");
  }

  async function deleteComment(id: string) {
    await supabase.from("comments").delete().eq("id", id);
  }

  const dlClass =
    days === null
      ? "text-muted-foreground"
      : days < 0
        ? "text-urgent font-medium"
        : days <= 7
          ? "text-warning-foreground font-medium"
          : "text-muted-foreground";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <div
        className="relative flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {/* Left status accent strip */}
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-1 rtl:right-0 ltr:left-0"
          style={{ backgroundColor: statusColor }}
        />
        <button
          onClick={toggleDone}
          className={cn(
            "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
          )}
          style={{
            borderColor: statusColor,
            backgroundColor: isDone || isProg ? statusColor : "transparent",
            color: statusFg,
          }}
        >
          {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          {isProg && <Clock className="h-3 w-3" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-sm font-medium leading-snug",
              isDone && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                priorityBadgeClass(task.priority)
              )}
            >
              {task.priority}
            </span>
            {task.department && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: getDepartmentColor(task.department) + "40",
                  color: getDepartmentColor(task.department),
                  backgroundColor: getDepartmentColor(task.department) + "12",
                }}
              >
                {task.department}
              </span>
            )}
            {(isDone || isProg) && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: statusColor + "22",
                  color: statusColor,
                  borderColor: statusColor + "55",
                  borderWidth: 1,
                  borderStyle: "solid",
                }}
              >
                {task.status}
              </span>
            )}
            {task.deadline && (
              <span className={cn("text-[11px]", dlClass)}>
                {formatDeadline(task.deadline)}
                {days !== null && ` · ${days >= 0 ? `${days} ימים` : "באיחור"}`}
              </span>
            )}
            {comments.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {comments.length}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <div className="border-t border-border bg-muted/30 p-3 sm:p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                כותרת
              </label>
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={saveTitleNote}
                className="bg-card"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  סטטוס
                </label>
                <Select
                  value={task.status}
                  onValueChange={(v) => updateField({ status: v })}
                >
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  דחיפות
                </label>
                <Select
                  value={task.priority}
                  onValueChange={(v) => updateField({ priority: v })}
                >
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  מחלקה
                </label>
                <Select
                  value={task.department ?? ""}
                  onValueChange={(v) => updateField({ department: v })}
                >
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                יעד סופי
              </label>
              <Input
                type="date"
                value={task.deadline ?? ""}
                onChange={(e) =>
                  updateField({ deadline: e.target.value || null })
                }
                className="bg-card"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                תת-משימות
              </label>
              <div className="space-y-1.5">
                {steps.map((s) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    onToggle={() => toggleStep(s)}
                    onSave={(v) => updateStepContent(s.id, v)}
                    onDelete={() => deleteStep(s.id)}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addStep();
                      }
                    }}
                    placeholder="הוסף תת-משימה…"
                    className="h-8 bg-card text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={addStep}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                הערה
              </label>
              <Textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                onBlur={saveTitleNote}
                placeholder="הערה או הסבר…"
                className="min-h-[60px] bg-card text-sm"
              />
            </div>

            {isAdminView && planId && (
              <InternalTasksPanel clientTaskId={task.id} planId={planId} />
            )}

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                תגובות והערות ({comments.length})
              </label>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-start gap-2 rounded-lg bg-card p-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-primary">
                        {c.author_name}
                      </div>
                      <div className="whitespace-pre-wrap text-foreground">
                        {c.body}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("he-IL")}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteComment(c.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-end gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="כתוב תגובה…"
                    className="min-h-[40px] flex-1 bg-card text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                  />
                  <Button onClick={addComment} disabled={!newComment.trim()}>
                    שלח
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteTask}
                className="text-urgent hover:bg-urgent/10 hover:text-urgent"
              >
                <Trash2 className="ms-2 h-3.5 w-3.5" />
                מחק משימה
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepRow({
  step,
  onToggle,
  onSave,
  onDelete,
}: {
  step: TaskStep;
  onToggle: () => void;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(step.content);
  const [focused, setFocused] = useState(false);

  // Sync local value with remote when not actively editing.
  useEffect(() => {
    if (!focused) setValue(step.content);
  }, [step.content, focused]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={step.done}
        onChange={onToggle}
        className="h-4 w-4 cursor-pointer accent-primary"
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (value.trim() && value !== step.content) onSave(value.trim());
          else if (!value.trim()) setValue(step.content);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-8 bg-card text-sm",
          step.done && "text-muted-foreground line-through"
        )}
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-urgent"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
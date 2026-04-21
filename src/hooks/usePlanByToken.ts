import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Plan, Task, TaskStep, Comment } from "@/hooks/usePlanRealtime";

/** Like usePlanRealtime but resolves a plan by share_token (client-safe link) */
export function usePlanByToken(token: string) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [steps, setSteps] = useState<Record<string, TaskStep[]>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    const { data: planRow, error: pe } = await supabase
      .from("plans")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();
    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }
    if (!planRow) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setPlan(planRow);

    const { data: tasksRows } = await supabase
      .from("tasks")
      .select("*")
      .eq("plan_id", planRow.id)
      .order("position", { ascending: true });
    const tList = tasksRows ?? [];
    setTasks(tList);

    if (tList.length > 0) {
      const ids = tList.map((t) => t.id);
      const [{ data: stepsRows }, { data: commentsRows }] = await Promise.all([
        supabase.from("task_steps").select("*").in("task_id", ids).order("position"),
        supabase.from("comments").select("*").in("task_id", ids).order("created_at"),
      ]);
      const grouped: Record<string, TaskStep[]> = {};
      (stepsRows ?? []).forEach((s) => {
        (grouped[s.task_id] ||= []).push(s);
      });
      setSteps(grouped);
      const cGrouped: Record<string, Comment[]> = {};
      (commentsRows ?? []).forEach((c) => {
        (cGrouped[c.task_id] ||= []).push(c);
      });
      setComments(cGrouped);
    } else {
      setSteps({});
      setComments({});
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!plan?.id) return;
    const planId = plan.id;
    const channel = supabase
      .channel(`plan-token-${planId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `plan_id=eq.${planId}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_steps" },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plans", filter: `id=eq.${planId}` },
        (payload) => setPlan(payload.new as Plan)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plan?.id, loadAll]);

  return { plan, tasks, steps, comments, loading, error, refresh: loadAll };
}
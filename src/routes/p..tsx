import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { usePlanRealtime } from "@/hooks/usePlanRealtime";
import { PlanView } from "@/components/PlanView";
import { isAdmin } from "@/lib/admin-session";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/p/")({
  component: PlanPage,
});

function PlanPage() {
  const { slug } = Route.useParams();
  const { plan, tasks, steps, comments, loading } = usePlanRealtime(slug);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin()) navigate({ to: "/login" });
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        טוען…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">התוכנית לא נמצאה</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">
            חזרה לרשימה
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${plan.share_token}`
      : `/c/${plan.share_token}`;

  return (
    <>
      <Toaster position="top-center" dir="rtl" />
      <PlanView
        plan={plan}
        tasks={tasks}
        steps={steps}
        comments={comments}
        isAdmin
        shareUrl={shareUrl}
      />
    </>
  );
}

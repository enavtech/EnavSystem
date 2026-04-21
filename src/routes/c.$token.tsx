import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanByToken } from "@/hooks/usePlanByToken";
import { PlanView } from "@/components/PlanView";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/c/$token")({
  component: ClientPlanPage,
  head: () => ({
    meta: [
      { title: "תוכנית עבודה" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function ClientPlanPage() {
  const { token } = Route.useParams();
  const { plan, tasks, steps, comments, loading } = usePlanByToken(token);

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
          <h1 className="text-2xl font-bold">הקישור לא תקין</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ייתכן שהקישור פג או הוסר. פנו אלינו לקבלת קישור חדש.
          </p>
          <Link to="/login" className="mt-4 inline-block text-primary underline text-sm">
            כניסת מנהל
          </Link>
        </div>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : `/c/${token}`;

  return (
    <>
      <Toaster position="top-center" dir="rtl" />
      <PlanView
        plan={plan}
        tasks={tasks}
        steps={steps}
        comments={comments}
        isAdmin={false}
        shareUrl={shareUrl}
      />
    </>
  );
}
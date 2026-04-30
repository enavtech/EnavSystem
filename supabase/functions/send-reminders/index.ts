// Supabase Edge Function — שולחת תזכורות מייל ללקוחות
// הרצה: מדי יום בשעה 08:00 דרך pg_cron
//
// הגדרה ב-Supabase Dashboard → SQL Editor:
//   select cron.schedule('daily-reminders', '0 8 * * *',
//     $$select net.http_post(
//       url := '<SUPABASE_FUNCTION_URL>/send-reminders',
//       headers := '{"Authorization": "Bearer <SUPABASE_SERVICE_ROLE_KEY>"}'::jsonb
//     )$$);
//
// דרישות:
//   1. חשבון Resend בחינם: https://resend.com
//   2. הוסף RESEND_API_KEY ל-Supabase → Settings → Edge Functions → Secrets

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "reminders@yourdomain.com";

Deno.serve(async (_req) => {
  if (!RESEND_API_KEY) {
    return new Response("RESEND_API_KEY לא מוגדר", { status: 500 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // שלוף תוכניות עם מייל לקוח שאינן ארכיון ואינן תבנית
  const { data: plans } = await db
    .from("plans")
    .select("id, name, share_token, client_email")
    .eq("archived", false)
    .eq("is_template", false)
    .not("client_email", "is", null);

  if (!plans?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in3Days = new Date(today);
  in3Days.setDate(today.getDate() + 3);

  let sent = 0;

  for (const plan of plans) {
    // משימות שה-deadline שלהן בין היום ל-3 ימים קדימה ועדיין פתוחות
    const { data: tasks } = await db
      .from("tasks")
      .select("title, deadline, priority, department")
      .eq("plan_id", plan.id)
      .neq("status", "הושלם")
      .gte("deadline", today.toISOString().slice(0, 10))
      .lte("deadline", in3Days.toISOString().slice(0, 10));

    if (!tasks?.length) continue;

    const taskLines = tasks
      .map((t) => {
        const days = Math.round((new Date(t.deadline!).getTime() - today.getTime()) / 86400000);
        const when = days === 0 ? "היום" : days === 1 ? "מחר" : `בעוד ${days} ימים`;
        return `• ${t.title} — ${when} (${t.priority}${t.department ? ` · ${t.department}` : ""})`;
      })
      .join("\n");

    const clientUrl = `${Deno.env.get("PUBLIC_ORIGIN") ?? "https://yourapp.com"}/c/${plan.share_token}`;

    const html = `
      <div dir="rtl" style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#2D4A6B">תזכורת: משימות קרובות — ${plan.name}</h2>
        <p>שלום,</p>
        <p>להלן המשימות הקרובות בתוכנית שלך:</p>
        <pre style="background:#f8f9fa;padding:12px;border-radius:8px;line-height:1.8">${taskLines}</pre>
        <p>
          <a href="${clientUrl}" style="background:#2D4A6B;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
            צפה בתוכנית המלאה
          </a>
        </p>
        <p style="color:#888;font-size:12px">הודעה אוטומטית · לביטול יש לפנות ליועץ שלך</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: plan.client_email,
        subject: `תזכורת: ${tasks.length} משימות קרובות — ${plan.name}`,
        html,
      }),
    });

    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ sent, total: plans.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

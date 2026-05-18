import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const DIGEST_TO_EMAIL = Deno.env.get("DIGEST_TO_EMAIL") || "jmj@jonesy-co.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface LoginRow {
  email: string;
  login_count: number;
  last_login: string;
}

interface ActivityRow {
  email: string;
  suite: string;
  action: string;
  action_count: number;
}

async function getLogins(): Promise<LoginRow[]> {
  const { data } = await supabase.rpc("get_daily_logins");
  return data || [];
}

async function getDataActivity(): Promise<ActivityRow[]> {
  const { data } = await supabase.rpc("get_daily_data_activity");
  return data || [];
}

function buildEmailHtml(
  logins: LoginRow[],
  activity: ActivityRow[],
  date: string
): string {
  const loginRows = logins.length > 0
    ? logins
        .map(
          (l) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #eee">${l.email}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${l.login_count}</td>
             <td style="padding:8px;border-bottom:1px solid #eee">${new Date(l.last_login).toLocaleString("en-GB", { timeZone: "America/New_York" })}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:8px;color:#999">No logins in the last 24 hours</td></tr>`;

  const suites = [...new Set(activity.map((a) => a.suite))];
  const activitySection = suites.length > 0
    ? suites
        .map((suite) => {
          const rows = activity.filter((a) => a.suite === suite);
          return `
          <h3 style="color:#111827;margin:16px 0 8px;text-transform:capitalize">${suite}</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr style="background:#f9fafb">
              <th style="padding:8px;text-align:left">User</th>
              <th style="padding:8px;text-align:left">Action</th>
              <th style="padding:8px;text-align:center">Count</th>
            </tr>
            ${rows
              .map(
                (r) =>
                  `<tr><td style="padding:8px;border-bottom:1px solid #eee">${r.email}</td>
                   <td style="padding:8px;border-bottom:1px solid #eee">${r.action}</td>
                   <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.action_count}</td></tr>`
              )
              .join("")}
          </table>`;
        })
        .join("")
    : `<p style="color:#999">No data changes in the last 24 hours</p>`;

  return `
  <div style="font-family:'DM Sans',sans-serif;max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#111827;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:22px">Jonesy&Co Daily Usage Report</h1>
      <p style="margin:4px 0 0;opacity:0.7;font-size:14px">${date}</p>
    </div>
    <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      <h2 style="color:#111827;margin:0 0 12px">Logins (Last 24h)</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f9fafb">
          <th style="padding:8px;text-align:left">User</th>
          <th style="padding:8px;text-align:center">Sessions</th>
          <th style="padding:8px;text-align:left">Last Login</th>
        </tr>
        ${loginRows}
      </table>

      <h2 style="color:#111827;margin:24px 0 12px">Data Activity (Last 24h)</h2>
      ${activitySection}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
      Sent from Jonesy&Co Suite · Supabase Edge Function
    </p>
  </div>`;
}

Deno.serve(async () => {
  try {
    const logins = await getLogins();
    const activity = await getDataActivity();
    const date = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });

    const html = buildEmailHtml(logins, activity, date);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jonesy&Co <digest@updates.jonesy-co.com>",
        to: DIGEST_TO_EMAIL.split(",").map((e: string) => e.trim()),
        subject: `Daily Usage Report — ${date}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      return new Response(`Email send failed: ${err}`, { status: 500 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        logins: logins.length,
        activity_events: activity.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(`Error: ${(err as Error).message}`, { status: 500 });
  }
});

import { NextResponse } from "next/server";

/** Cron send-reminders is disabled. Uncomment the block below and remove this handler to re-enable. */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Cron send-reminders is temporarily disabled." },
    { status: 503 },
  );
}

/*
import { NextResponse } from "next/server";
import { readSubscriptions, writeSubscriptions } from "@/lib/subscriptions-store";
import {
  buildCombinedReminderBody,
  localCalendarDate,
  schedulesDueNow,
} from "@/lib/reminders";
import { sendBossReminderSms } from "@/lib/sms";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const subs = await readSubscriptions();
  const now = new Date();
  const results: { id: string; status: string }[] = [];

  for (const sub of subs) {
    const due = schedulesDueNow(sub, now);
    if (due.length === 0) {
      results.push({ id: sub.id, status: "skipped" });
      continue;
    }

    const body = buildCombinedReminderBody(sub, due);
    const sent = await sendBossReminderSms(sub.phoneE164, body);

    if (!sent.ok) {
      results.push({ id: sub.id, status: `error: ${sent.error}` });
      continue;
    }

    const localDate = localCalendarDate(now, sub.timezone);
    const dueIds = new Set(due.map((d) => d.id));
    for (const sch of sub.schedules) {
      if (dueIds.has(sch.id)) {
        sch.lastReminderSentLocalDate = localDate;
      }
    }
    sub.updatedAt = now.toISOString();
    results.push({ id: sub.id, status: `sent (${due.length})` });
  }

  await writeSubscriptions(subs);

  return NextResponse.json({ ok: true, at: now.toISOString(), results });
}
*/

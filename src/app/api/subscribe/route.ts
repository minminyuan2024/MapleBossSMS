import { NextResponse } from "next/server";
import { subscribeSchema } from "@/lib/validation";
import { upsertSubscription } from "@/lib/subscriptions-store";
import { getMajorBosses } from "@/lib/bosses";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const body = parsed.data;
  const validIds = new Set(getMajorBosses().map((b) => b.id));
  const byId = new Map(getMajorBosses().map((b) => [b.id, b]));

  for (const sch of body.schedules) {
    if (!validIds.has(sch.bossId)) {
      return NextResponse.json(
        { error: `Unknown boss id for ${sch.bossName}.` },
        { status: 400 },
      );
    }
    const row = byId.get(sch.bossId)!;
    if (row.bossName !== sch.bossName) {
      return NextResponse.json(
        { error: `Boss id does not match name ${sch.bossName}.` },
        { status: 400 },
      );
    }
    if (row.wikiSlug !== sch.wikiTitle) {
      return NextResponse.json(
        { error: `Wiki title mismatch for ${sch.bossName}.` },
        { status: 400 },
      );
    }
  }

  const record = await upsertSubscription({
    id: body.subscriptionId,
    phoneE164: body.phone,
    timezone: body.timezone,
    schedules: body.schedules.map((s) => ({
      id: s.id,
      bossName: s.bossName,
      wikiTitle: s.wikiTitle,
      bossId: s.bossId,
      reminderWeekday: s.reminderWeekday,
      reminderTimeLocal: s.reminderTimeLocal,
    })),
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: record.id,
    message:
      "Subscription saved. SMS uses Twilio plus a scheduler hitting the cron route (see README).",
  });
}

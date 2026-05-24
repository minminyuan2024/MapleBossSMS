import { NextResponse } from "next/server";

/** Cron test-sms is disabled. Uncomment the block below and remove this handler to re-enable. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Cron test-sms is temporarily disabled." },
    { status: 503 },
  );
}

/*
import { NextResponse } from "next/server";
import { subscribeSchema } from "@/lib/validation";
import { sendBossReminderSms } from "@/lib/sms";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = subscribeSchema
    .pick({ phone: true })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.phone?.[0] ?? "Invalid phone." },
      { status: 400 },
    );
  }

  const r = await sendBossReminderSms(
    parsed.data.phone,
    "Maple Boss Notify: your SMS channel is working.",
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
*/

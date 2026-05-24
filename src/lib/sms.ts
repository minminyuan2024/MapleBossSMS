import twilio from "twilio";

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function sendBossReminderSms(
  toE164: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getTwilioClient();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!client) {
    return { ok: false, error: "Twilio is not configured (missing credentials)." };
  }

  if (!messagingServiceSid && !fromNumber) {
    return {
      ok: false,
      error:
        "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER in environment.",
    };
  }

  try {
    await client.messages.create({
      to: toE164,
      ...(messagingServiceSid
        ? { messagingServiceSid }
        : { from: fromNumber! }),
      body,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

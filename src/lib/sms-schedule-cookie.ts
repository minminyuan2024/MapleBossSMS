/** Cookie: JSON `{ v:1, includeIds, slots }` — “Include in SMS” boss ids + per-boss weekday/time. */

import type { MajorBossEntry } from "@/lib/bosses";

export const SMS_SCHEDULE_COOKIE = "maple_sms_schedule";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type SmsSlot = { weekday: number; time: string };

export type SmsScheduleCookieV1 = {
  v: 1;
  includeIds: string[];
  slots: Record<string, SmsSlot>;
};

function escapeRegExp(s: string): string {
  return s.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

function normalizeTimeHm(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isValidWeekday(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6;
}

export function readSmsScheduleFromCookie(): SmsScheduleCookieV1 | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${escapeRegExp(SMS_SCHEDULE_COOKIE)}=([^;]*)`),
  );
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(m[1])) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (rec.v !== 1) return null;
    if (!Array.isArray(rec.includeIds) || !rec.includeIds.every((x) => typeof x === "string")) {
      return null;
    }
    if (!rec.slots || typeof rec.slots !== "object") return null;
    const slots: Record<string, SmsSlot> = {};
    for (const [name, val] of Object.entries(rec.slots as Record<string, unknown>)) {
      if (typeof name !== "string" || !val || typeof val !== "object") continue;
      const o = val as Record<string, unknown>;
      const time = normalizeTimeHm(o.time);
      if (!isValidWeekday(o.weekday) || !time) continue;
      slots[name] = { weekday: o.weekday, time };
    }
    return { v: 1, includeIds: rec.includeIds as string[], slots };
  } catch {
    return null;
  }
}

export function writeSmsScheduleToCookie(payload: SmsScheduleCookieV1): void {
  const body: SmsScheduleCookieV1 = {
    v: 1,
    includeIds: payload.includeIds,
    slots: payload.slots,
  };
  const encoded = encodeURIComponent(JSON.stringify(body));
  document.cookie = `${SMS_SCHEDULE_COOKIE}=${encoded};path=/;max-age=${MAX_AGE};SameSite=Lax`;
}

export function clearSmsScheduleCookie(): void {
  document.cookie = `${SMS_SCHEDULE_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

/**
 * Apply cookie data to current roster. Unknown ids / boss names are dropped.
 */
export function mergeSmsScheduleFromCookie(
  roster: MajorBossEntry[],
  raw: SmsScheduleCookieV1 | null,
): { selected: Set<string>; reminders: Record<string, SmsSlot> } {
  const validIds = new Set(roster.map((b) => b.id));
  const validNames = new Set(roster.map((b) => b.bossName));

  if (!raw) {
    return { selected: new Set(), reminders: {} };
  }

  const selected = new Set(raw.includeIds.filter((id) => validIds.has(id)));
  const reminders: Record<string, SmsSlot> = {};
  for (const [name, slot] of Object.entries(raw.slots)) {
    if (!validNames.has(name)) continue;
    const time = normalizeTimeHm(slot.time);
    if (!time || !isValidWeekday(slot.weekday)) continue;
    reminders[name] = { weekday: slot.weekday, time };
  }
  return { selected, reminders };
}

export function buildSmsScheduleCookiePayload(
  roster: MajorBossEntry[],
  selected: Set<string>,
  reminderByBoss: Record<string, SmsSlot>,
): SmsScheduleCookieV1 {
  const validIds = new Set(roster.map((b) => b.id));
  const validNames = new Set(roster.map((b) => b.bossName));
  const slots: Record<string, SmsSlot> = {};
  for (const [name, slot] of Object.entries(reminderByBoss)) {
    if (!validNames.has(name)) continue;
    const time = normalizeTimeHm(slot.time);
    if (!time || !isValidWeekday(slot.weekday)) continue;
    slots[name] = { weekday: slot.weekday, time };
  }
  return {
    v: 1,
    includeIds: [...selected].filter((id) => validIds.has(id)),
    slots,
  };
}

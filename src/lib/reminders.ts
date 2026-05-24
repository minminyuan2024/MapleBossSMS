import type { BossSchedule, SubscriptionRecord } from "@/lib/subscriptions-store";

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Normalize stored `HH:mm` / `H:mm` / `HH:mm:ss` for comparisons and grouping. */
export function normalizeReminderTimeHm(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return raw.trim();
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return raw.trim();
  const hh = Math.min(23, Math.max(0, Math.floor(h)));
  const mm = Math.min(59, Math.max(0, Math.floor(min)));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Groups schedules that fire at the same local weekday + wall time (one SMS block). */
export function reminderSlotKey(
  sch: Pick<BossSchedule, "reminderWeekday" | "reminderTimeLocal">,
): string {
  return `${sch.reminderWeekday}|${normalizeReminderTimeHm(sch.reminderTimeLocal)}`;
}

/** Distinct local weekday + wall-time combinations (one per cron reminder “slot”). */
export function countDistinctReminderSlots(
  schedules: Pick<BossSchedule, "reminderWeekday" | "reminderTimeLocal">[],
): number {
  if (schedules.length === 0) return 0;
  return new Set(schedules.map((s) => reminderSlotKey(s))).size;
}

export function localCalendarDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function localWeekdayAndTime(
  date: Date,
  timeZone: string,
): { weekday: number; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value;

  const wdRaw = pick("weekday");
  const wd = wdRaw?.replace(/\.$/, "") ?? "";
  const hourStr = pick("hour");
  const minuteStr = pick("minute");
  if (!wd || hourStr == null || minuteStr == null) {
    throw new Error("Could not resolve local time parts.");
  }
  const weekday = WEEKDAY_SHORT[wd];
  if (weekday === undefined) {
    throw new Error(`Unknown weekday token: ${wd}`);
  }
  return {
    weekday,
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

function parseHm(s: string): { hour: number; minute: number } {
  const norm = normalizeReminderTimeHm(s);
  const [h, m] = norm.split(":").map(Number);
  return { hour: h, minute: m };
}

function minutesOfDay(h: number, m: number): number {
  return h * 60 + m;
}

function scheduleMatchesNow(
  sch: BossSchedule,
  timezone: string,
  now: Date,
): boolean {
  const localDate = localCalendarDate(now, timezone);
  if (sch.lastReminderSentLocalDate === localDate) return false;

  const { weekday, hour, minute } = localWeekdayAndTime(now, timezone);
  if (weekday !== sch.reminderWeekday) return false;

  const target = parseHm(sch.reminderTimeLocal);
  const diff = Math.abs(
    minutesOfDay(hour, minute) - minutesOfDay(target.hour, target.minute),
  );
  return diff <= 25;
}

/** Schedules that should receive an SMS on this cron tick. */
export function schedulesDueNow(
  sub: SubscriptionRecord,
  now: Date = new Date(),
): BossSchedule[] {
  return sub.schedules.filter((s) => scheduleMatchesNow(s, sub.timezone, now));
}

export function buildCombinedReminderBody(
  _sub: SubscriptionRecord,
  due: BossSchedule[],
): string {
  const seenId = new Set<string>();
  const unique = due.filter((s) => {
    if (seenId.has(s.id)) return false;
    seenId.add(s.id);
    return true;
  });

  const groups = new Map<string, BossSchedule[]>();
  for (const sch of unique) {
    const k = reminderSlotKey(sch);
    const g = groups.get(k) ?? [];
    g.push(sch);
    groups.set(k, g);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const x = a[0];
    const y = b[0];
    if (x.reminderWeekday !== y.reminderWeekday) return x.reminderWeekday - y.reminderWeekday;
    return normalizeReminderTimeHm(x.reminderTimeLocal).localeCompare(
      normalizeReminderTimeHm(y.reminderTimeLocal),
    );
  });

  const blocks = sortedGroups.map((arr) => {
    const s0 = arr[0];
    const day =
      WEEKDAY_LONG[s0.reminderWeekday] ?? `Day ${s0.reminderWeekday}`;
    const hm = normalizeReminderTimeHm(s0.reminderTimeLocal);
    const names = [...new Set(arr.map((s) => s.bossName))].sort((a, b) =>
      a.localeCompare(b),
    );
    const bullets = names.map((n) => `  • ${n}`).join("\n");
    return `${day} · ${hm}\n${bullets}`;
  });

  const header = "Maple boss reminder";
  const base = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const footer = base ? `\n\nManage: ${base}` : "";

  return `${header}\n\n${blocks.join("\n\n")}${footer}`;
}

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { MajorBossEntry } from "@/lib/bosses";
import { getMajorBosses, resolveCatalogBossByStoredId } from "@/lib/bosses";

/** Stable id per boss row (used for upsert + cron de-dupe). */
export type BossSchedule = {
  id: string;
  bossName: string;
  /** MediaWiki page title for thumbnails (same as wiki slug in our catalog). */
  wikiTitle: string;
  bossId: string;
  reminderWeekday: number;
  reminderTimeLocal: string;
  /** YYYY-MM-DD in subscriber timezone — at most one SMS per schedule per local day */
  lastReminderSentLocalDate?: string;
};

export type SubscriptionRecord = {
  id: string;
  phoneE164: string;
  timezone: string;
  schedules: BossSchedule[];
  createdAt: string;
  updatedAt: string;
};

type LegacySubscriptionRecord = {
  id: string;
  phoneE164: string;
  bossIds: string[];
  timezone: string;
  reminderWeekday: number;
  reminderTimeLocal: string;
  lastReminderSentLocalDate?: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const SUBS_FILE = path.join(DATA_DIR, "subscriptions.json");

function isLegacyRow(x: unknown): x is LegacySubscriptionRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.bossIds) &&
    typeof o.reminderWeekday === "number" &&
    !Array.isArray(o.schedules)
  );
}

function migrateLegacy(legacy: LegacySubscriptionRecord): SubscriptionRecord {
  const bosses = getMajorBosses();
  const byName = new Map<string, { wikiTitle: string; bossId: string }>();

  for (const id of legacy.bossIds) {
    const b = resolveCatalogBossByStoredId(id, bosses);
    if (!b) continue;
    byName.set(b.bossName, { wikiTitle: b.wikiSlug, bossId: b.id });
  }

  const schedules: BossSchedule[] = [...byName.entries()].map(([bossName, g]) => ({
    id: `boss:${bossName}`,
    bossName,
    wikiTitle: g.wikiTitle,
    bossId: g.bossId,
    reminderWeekday: legacy.reminderWeekday,
    reminderTimeLocal: legacy.reminderTimeLocal,
    lastReminderSentLocalDate: legacy.lastReminderSentLocalDate,
  }));

  return {
    id: legacy.id,
    phoneE164: legacy.phoneE164,
    timezone: legacy.timezone,
    schedules,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

function normalizeBossSchedule(
  raw: unknown,
  bosses: MajorBossEntry[],
): { schedule: BossSchedule; didMigrate: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || typeof o.bossName !== "string" || typeof o.wikiTitle !== "string")
    return null;
  if (typeof o.reminderWeekday !== "number" || typeof o.reminderTimeLocal !== "string")
    return null;

  const rawBossId = o.bossId;
  const hasBossId = typeof rawBossId === "string" && rawBossId.length > 0;
  const legacyDiffIds = o.difficultyIds;
  const hasLegacyDiff =
    Array.isArray(legacyDiffIds) &&
    legacyDiffIds.length > 0 &&
    !hasBossId;

  let row: MajorBossEntry | null = null;
  if (hasBossId) {
    row = bosses.find((b) => b.id === rawBossId) ?? null;
    if (row && row.bossName !== o.bossName) return null;
  }
  if (!row && hasLegacyDiff) {
    const first = String((legacyDiffIds as unknown[])[0]);
    row = resolveCatalogBossByStoredId(first, bosses);
  }
  if (!row) {
    row = bosses.find((b) => b.bossName === o.bossName) ?? null;
  }
  if (!row) return null;

  const last = o.lastReminderSentLocalDate;
  const schedule: BossSchedule = {
    id: o.id,
    bossName: row.bossName,
    wikiTitle: row.wikiSlug,
    bossId: row.id,
    reminderWeekday: o.reminderWeekday,
    reminderTimeLocal: o.reminderTimeLocal,
  };
  if (typeof last === "string" && last.length > 0) {
    schedule.lastReminderSentLocalDate = last;
  }

  const didMigrate = hasLegacyDiff || !hasBossId;
  return { schedule, didMigrate };
}

function normalizeSubscription(
  raw: unknown,
): { record: SubscriptionRecord; didMigrate: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  if (isLegacyRow(raw)) {
    return { record: migrateLegacy(raw), didMigrate: true };
  }
  const o = raw as SubscriptionRecord;
  if (!Array.isArray(o.schedules)) return null;
  if (typeof o.phoneE164 !== "string" || typeof o.timezone !== "string") return null;
  if (typeof o.id !== "string" || typeof o.createdAt !== "string" || typeof o.updatedAt !== "string")
    return null;

  const bosses = getMajorBosses();
  const schedules: BossSchedule[] = [];
  let didMigrate = false;
  for (const s of o.schedules) {
    const n = normalizeBossSchedule(s, bosses);
    if (!n) return null;
    if (n.didMigrate) didMigrate = true;
    schedules.push(n.schedule);
  }

  return {
    record: { ...o, schedules },
    didMigrate,
  };
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SUBS_FILE);
  } catch {
    await fs.writeFile(SUBS_FILE, "[]\n", "utf8");
  }
}

export async function readSubscriptions(): Promise<SubscriptionRecord[]> {
  await ensureStore();
  const raw = await fs.readFile(SUBS_FILE, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  const rows: SubscriptionRecord[] = [];
  let shouldRewrite = false;
  for (const item of parsed) {
    const n = normalizeSubscription(item);
    if (n) {
      rows.push(n.record);
      if (n.didMigrate) shouldRewrite = true;
    }
  }
  if (shouldRewrite) {
    await writeSubscriptions(rows);
  }
  return rows;
}

export async function writeSubscriptions(
  rows: SubscriptionRecord[],
): Promise<void> {
  await ensureStore();
  await fs.writeFile(SUBS_FILE, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

export async function upsertSubscription(
  input: Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<SubscriptionRecord> {
  const rows = await readSubscriptions();
  const now = new Date().toISOString();
  let existingIdx = -1;
  if (input.id) {
    existingIdx = rows.findIndex((r) => r.id === input.id);
  }
  if (existingIdx < 0) {
    existingIdx = rows.findIndex((r) => r.phoneE164 === input.phoneE164);
  }

  if (existingIdx >= 0) {
    const prev = rows[existingIdx];
    const prevById = new Map(prev.schedules.map((s) => [s.id, s]));
    const mergedSchedules = input.schedules.map((s) => ({
      ...s,
      lastReminderSentLocalDate:
        prevById.get(s.id)?.lastReminderSentLocalDate ?? s.lastReminderSentLocalDate,
    }));
    const next: SubscriptionRecord = {
      ...prev,
      ...input,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: now,
      schedules: mergedSchedules,
    };
    rows[existingIdx] = next;
    await writeSubscriptions(rows);
    return next;
  }

  const created: SubscriptionRecord = {
    id: randomUUID(),
    phoneE164: input.phoneE164,
    timezone: input.timezone,
    schedules: input.schedules,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  await writeSubscriptions(rows);
  return created;
}

import majorBosses from "@/data/major-bosses.json";

export type MajorBossEntry = {
  id: string;
  bossName: string;
  wikiSlug: string;
};

/** Last path segment of legacy per-difficulty row ids (e.g. `zakum-easy` → `zakum`). */
const LEGACY_ID_SUFFIX = new Set([
  "easy",
  "normal",
  "hard",
  "chaos",
  "extreme",
  "story",
  "solo",
]);

export const WIKI_BOSS_LIST_URL =
  "https://maplestorywiki.net/w/Bosses#Major_Bosses";

export function getMajorBosses(): MajorBossEntry[] {
  return majorBosses as MajorBossEntry[];
}

export function wikiUrlForBoss(slug: string): string {
  return `https://maplestorywiki.net/w/${slug}`;
}

/**
 * Map legacy per-difficulty catalog ids onto the current one-row-per-boss roster.
 */
export function resolveCatalogBossByStoredId(
  storedId: string,
  roster: MajorBossEntry[] = getMajorBosses(),
): MajorBossEntry | null {
  const byId = new Map(roster.map((b) => [b.id, b]));
  let cur = storedId;
  for (let i = 0; i < 12; i++) {
    const hit = byId.get(cur);
    if (hit) return hit;
    const slash = cur.lastIndexOf("-");
    if (slash <= 0) break;
    const last = cur.slice(slash + 1).toLowerCase();
    if (!LEGACY_ID_SUFFIX.has(last)) break;
    cur = cur.slice(0, slash);
  }
  return byId.get(cur) ?? null;
}

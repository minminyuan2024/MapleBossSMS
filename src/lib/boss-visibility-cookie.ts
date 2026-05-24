/** Cookie: JSON array of boss names, `["*"]` = entire roster, `["__default__"]` = default 8 subset. Missing = same as default until you save. */

export const BOSS_VISIBILITY_COOKIE = "maple_boss_visible";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Shown when there is no cookie yet (first visit). Must match `bossName` in major-bosses.json. */
export const DEFAULT_VISIBLE_BOSS_NAMES: readonly string[] = [
  "Chosen Seren",
  "Kalos",
  "First Adversary",
  "Kaling",
  "Malefic Star",
  "Limbo",
  "Baldrix",
  "Jupiter",
] as const;

/** Stored alone in the cookie array to mean “show every boss on the roster”. */
export const SHOW_ALL_SENTINEL = "*";

/**
 * Stored alone in the cookie array to mean “use the app default subset”
 * (`DEFAULT_VISIBLE_BOSS_NAMES` ∩ roster). Persists “Select default” + Save.
 */
export const SHOW_DEFAULT_SENTINEL = "__default__";

function escapeRegExp(s: string): string {
  return s.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

export function readBossVisibilityFromCookie(): string[] | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${escapeRegExp(BOSS_VISIBILITY_COOKIE)}=([^;]*)`),
  );
  if (!m?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(m[1])) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

export function writeBossVisibilityCookie(visibleNames: string[]): void {
  const payload = encodeURIComponent(JSON.stringify(visibleNames));
  document.cookie = `${BOSS_VISIBILITY_COOKIE}=${payload};path=/;max-age=${MAX_AGE};SameSite=Lax`;
}

export function clearBossVisibilityCookie(): void {
  document.cookie = `${BOSS_VISIBILITY_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

/** Boss names shown on first visit (no cookie). Intersect with current roster. */
export function defaultBossVisibilityFromRoster(allNames: string[]): Set<string> {
  const roster = new Set(allNames);
  const d = new Set<string>();
  for (const n of DEFAULT_VISIBLE_BOSS_NAMES) {
    if (roster.has(n)) d.add(n);
  }
  return d;
}

/**
 * Resolve which boss cards to show.
 * - No cookie → default late-game roster (`DEFAULT_VISIBLE_BOSS_NAMES` ∩ current data).
 * - `["*"]` → entire roster (persists “show all” across reloads).
 * - `["__default__"]` → same default subset, but persisted (after “Select default” + Save).
 * - `[]` → none.
 * - Named list → exactly those bosses still on the roster (no auto-adding new roster names).
 */
export function mergedVisibilityFromCookie(allNames: string[]): Set<string> {
  const roster = new Set(allNames);
  const raw = readBossVisibilityFromCookie();

  if (raw === null) {
    return defaultBossVisibilityFromRoster(allNames);
  }

  if (raw.length === 1 && raw[0] === SHOW_ALL_SENTINEL) {
    return new Set(allNames);
  }

  if (raw.length === 1 && raw[0] === SHOW_DEFAULT_SENTINEL) {
    return defaultBossVisibilityFromRoster(allNames);
  }

  if (raw.length === 0) {
    return new Set();
  }

  return new Set(raw.filter((n) => roster.has(n)));
}

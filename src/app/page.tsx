"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { getMajorBosses, wikiUrlForBoss, WIKI_BOSS_LIST_URL } from "@/lib/bosses";
import { SubscribeModal } from "@/components/subscribe-modal";
import { SmsSlotsSummaryModal } from "@/components/sms-slots-summary-modal";
import { BossVisibilityModal } from "@/components/boss-visibility-modal";
import { BossPortrait } from "@/components/boss-portrait";
import type { BossScheduleInput } from "@/lib/validation";
import {
  defaultBossVisibilityFromRoster,
  mergedVisibilityFromCookie,
  SHOW_ALL_SENTINEL,
  SHOW_DEFAULT_SENTINEL,
  writeBossVisibilityCookie,
} from "@/lib/boss-visibility-cookie";
import {
  buildSmsScheduleCookiePayload,
  mergeSmsScheduleFromCookie,
  readSmsScheduleFromCookie,
  writeSmsScheduleToCookie,
  type SmsSlot,
} from "@/lib/sms-schedule-cookie";
import { countDistinctReminderSlots } from "@/lib/reminders";

const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Next calendar moment (local) at this weekday + wall time, strictly after `from`. */
function nextWeeklyOccurrence(weekday: number, timeHm: string, from: Date = new Date()): Date {
  const [hh, mm] = timeHm.split(":").map(Number);
  const fromMs = from.getTime();
  for (let delta = 0; delta < 8; delta++) {
    const t = new Date(from);
    t.setDate(from.getDate() + delta);
    t.setHours(hh, mm, 0, 0);
    t.setSeconds(0, 0);
    t.setMilliseconds(0);
    if (t.getDay() === weekday && t.getTime() > fromMs) return t;
  }
  const t = new Date(from);
  t.setDate(from.getDate() + 14);
  t.setHours(hh, mm, 0, 0);
  t.setSeconds(0, 0);
  t.setMilliseconds(0);
  return t;
}

function formatNextLocalMonthDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * The reminder `Date` is built in the user's local timezone (browser). Reads the same
 * instant in UTC (`getUTC*`). Hours **0–11** → **`+0`…`+11`**; hours **12–23** → **`-12`…`-1`**
 * via `hour - 24`. With minutes: **`+9:30`**, **`-12:15`** (12:15 UTC), **`-1:45`** (23:45 UTC), etc.
 */
function formatUtcFromLocalInstant(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();
  const whole = m === 0 && s === 0 && ms === 0;

  if (h <= 11) {
    if (whole) return `+${h}`;
    return `+${h}:${String(m).padStart(2, "0")}`;
  }

  const dh = h - 24;
  if (whole) return String(dh);
  return `${dh}:${String(m).padStart(2, "0")}`;
}

function visibilitySetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export default function HomePage() {
  const bossesSorted = useMemo(
    () =>
      [...getMajorBosses()].sort((a, b) => a.bossName.localeCompare(b.bossName)),
    [],
  );
  const totalBosses = bossesSorted.length;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [smsSummaryOpen, setSmsSummaryOpen] = useState(false);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  /** Starts as default 8 (SSR / no cookie); syncs from cookie after mount. */
  const [bossVisibility, setBossVisibility] = useState<Set<string>>(() =>
    defaultBossVisibilityFromRoster([...getMajorBosses()].map((b) => b.bossName)),
  );
  const [query, setQuery] = useState("");
  const [reminderByBoss, setReminderByBoss] = useState<Record<string, SmsSlot>>({});
  /** After first client read of `maple_sms_schedule` cookie; avoids overwriting saved prefs before hydrate. */
  const [smsPrefsHydrated, setSmsPrefsHydrated] = useState(false);
  /** `wikiSlug` → `/api/local-boss-pic?...` from files in `src/pic` only (no web/wiki). */
  const [srcPicUrls, setSrcPicUrls] = useState<Record<string, string>>({});
  const [picManifestReady, setPicManifestReady] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function patchReminder(name: string, patch: Partial<SmsSlot>) {
    setReminderByBoss((prev) => {
      const cur = prev[name] ?? { weekday: 0, time: "20:00" };
      return { ...prev, [name]: { ...cur, ...patch } };
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/local-boss-pic/manifest");
        if (res.ok) {
          const data = (await res.json()) as Record<string, string>;
          if (!cancelled) setSrcPicUrls(data);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPicManifestReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bossesSorted;
    return bossesSorted.filter((b) => b.bossName.toLowerCase().includes(q));
  }, [bossesSorted, query]);

  const allBossNames = useMemo(
    () => bossesSorted.map((b) => b.bossName),
    [bossesSorted],
  );

  useLayoutEffect(() => {
    if (allBossNames.length === 0) return;
    setBossVisibility(mergedVisibilityFromCookie(allBossNames));
  }, [allBossNames]);

  useLayoutEffect(() => {
    if (bossesSorted.length === 0) {
      setSmsPrefsHydrated(true);
      return;
    }
    const merged = mergeSmsScheduleFromCookie(bossesSorted, readSmsScheduleFromCookie());
    setSelected(merged.selected);
    setReminderByBoss(merged.reminders);
    setSmsPrefsHydrated(true);
  }, [bossesSorted]);

  useEffect(() => {
    if (!smsPrefsHydrated) return;
    writeSmsScheduleToCookie(
      buildSmsScheduleCookiePayload(bossesSorted, selected, reminderByBoss),
    );
  }, [smsPrefsHydrated, bossesSorted, selected, reminderByBoss]);

  const visibleFiltered = useMemo(() => {
    return filtered.filter((b) => bossVisibility.has(b.bossName));
  }, [filtered, bossVisibility]);

  function handleSaveBossVisibility(next: Set<string>) {
    const all = new Set(allBossNames);
    const isAll =
      next.size === all.size && [...all].every((n) => next.has(n));
    if (isAll) {
      writeBossVisibilityCookie([SHOW_ALL_SENTINEL]);
      setBossVisibility(new Set(all));
      return;
    }
    const defaultSet = defaultBossVisibilityFromRoster(allBossNames);
    if (visibilitySetsEqual(next, defaultSet)) {
      writeBossVisibilityCookie([SHOW_DEFAULT_SENTINEL]);
      setBossVisibility(new Set(defaultSet));
      return;
    }
    writeBossVisibilityCookie([...next]);
    setBossVisibility(new Set(next));
  }

  const schedulesPayload: BossScheduleInput[] = useMemo(() => {
    const out: BossScheduleInput[] = [];
    for (const b of bossesSorted) {
      if (!selected.has(b.id)) continue;
      const slot = reminderByBoss[b.bossName] ?? { weekday: 0, time: "20:00" };
      out.push({
        id: `boss:${b.bossName}`,
        bossName: b.bossName,
        wikiTitle: b.wikiSlug,
        bossId: b.id,
        reminderWeekday: slot.weekday,
        reminderTimeLocal: slot.time,
      });
    }
    out.sort((a, b) => a.bossName.localeCompare(b.bossName));
    return out;
  }, [bossesSorted, selected, reminderByBoss]);

  const distinctSmsSlotCount = useMemo(
    () => countDistinctReminderSlots(schedulesPayload),
    [schedulesPayload],
  );

  const filteredCount = filtered.length;
  const visibleCount = visibleFiltered.length;
  const hasFilter = query.trim().length > 0;
  const visibilityActive = bossVisibility.size < totalBosses;

  return (
    <div className="ms-page min-h-screen">
      <a
        href="#boss-grid"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to boss list
      </a>

      {/* Top bar */}
      <div className="border-b border-slate-200/90 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-display text-sm font-semibold tracking-tight text-ink">
            Maple Boss Notify
          </span>
          <a
            href={WIKI_BOSS_LIST_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-accent hover:underline"
          >
            Wiki source ↗
          </a>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-surface to-surface">
        <div
          className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-maple-leaf/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-16">
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
              MapleStory · Major bosses
            </p>
            <h1 className="font-display text-[2.15rem] font-semibold leading-[1.12] tracking-tight text-ink sm:text-5xl sm:leading-[1.08]">
              Text reminders when{" "}
              <span className="text-accent">your</span> weeklies are due.
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-ink-muted">
              Pick which bosses get an SMS, set a weekly day and time on each portrait card (day,
              time, and Include in SMS are saved in a browser cookie on this device), then save your
              number. Messages go out when your cron hits the reminder window (Twilio + scheduler).
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm ring-1 ring-slate-200/80">
                {totalBosses} wiki bosses
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm ring-1 ring-slate-200/80">
                {selected.size} reminder{selected.size === 1 ? "" : "s"} on
              </span>
              <button
                type="button"
                onClick={() => setSmsSummaryOpen(true)}
                aria-haspopup="dialog"
                aria-label={`SMS subscription summary: ${distinctSmsSlotCount} time slot${distinctSmsSlotCount === 1 ? "" : "s"}, ${schedulesPayload.length} boss${schedulesPayload.length === 1 ? "" : "es"}`}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent ring-1 ring-blue-200/60 transition hover:bg-blue-100/90 hover:ring-blue-300/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {distinctSmsSlotCount} SMS slot{distinctSmsSlotCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-surface-card p-6 shadow-soft ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Next step
            </p>
            <p className="mt-2 font-display text-lg font-semibold text-ink">Save SMS subscription</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Opens a short form: phone (E.164) and timezone. Your per-boss times are taken from the
              cards below.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              Subscribe for SMS
            </button>
            {schedulesPayload.length === 0 && (
              <p className="mt-3 text-center text-xs text-amber-700">
                Turn on “Include in SMS” on at least one card to enable save.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div
        id="boss-grid"
        className="sticky top-0 z-20 border-b border-slate-200/90 bg-surface-card/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Boss roster</h2>
            <p className="text-xs text-ink-muted">
              {visibleCount} card{visibleCount === 1 ? "" : "s"} in view
              {hasFilter ? ` · ${filteredCount} match search` : ""}
              {visibilityActive
                ? ` · ${bossVisibility.size} boss${bossVisibility.size === 1 ? "" : "es"} enabled`
                : ""}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:max-w-xl">
            <button
              type="button"
              onClick={() => setVisibilityModalOpen(true)}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-100 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Bosses shown
              <span className="ml-1.5 tabular-nums text-ink-muted">
                ({bossVisibility.size}/{totalBosses})
              </span>
            </button>
            <label className="relative block min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Search boss name</span>
              <input
                type="search"
                placeholder="Search boss name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden
              >
                ⌕
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-4 py-10">
        {filteredCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
            <p className="font-display text-lg font-medium text-ink">No matches</p>
            <p className="mt-1 text-sm text-ink-muted">Try a different search term.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 text-sm font-semibold text-accent hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : visibleCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/40 py-16 text-center">
            <p className="font-display text-lg font-medium text-ink">No bosses in this view</p>
            <p className="mt-1 text-sm text-ink-muted">
              Turn bosses back on under <strong>Bosses shown</strong>, or clear the name search.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisibilityModalOpen(true)}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                Edit bosses shown
              </button>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFiltered.map((b) => {
              const name = b.bossName;
              const slug = b.wikiSlug;
              const slot = reminderByBoss[name] ?? { weekday: 0, time: "20:00" };
              const nextAt = nextWeeklyOccurrence(slot.weekday, slot.time);
              const portraitUrl = picManifestReady
                ? (srcPicUrls[slug] ?? null)
                : undefined;
              const smsOn = selected.has(b.id);

              return (
                <article
                  key={b.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-surface-card shadow-soft ring-1 ring-slate-100 transition hover:border-slate-300/90 hover:shadow-md"
                >
                  <div className="relative">
                    <div
                      className="absolute left-0 top-0 z-10 h-1 w-full bg-gradient-to-r from-accent via-blue-400 to-maple-leaf opacity-90"
                      aria-hidden
                    />
                    <BossPortrait
                      bossName={name}
                      imageUrl={portraitUrl}
                      wikiUrl={wikiUrlForBoss(slug)}
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                          {name}
                        </h3>
                        <p className="text-xs text-ink-muted">
                          SMS: {smsOn ? "included" : "off"}
                        </p>
                      </div>
                      <a
                        href={wikiUrlForBoss(slug)}
                        className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-accent ring-1 ring-slate-200/80 transition hover:bg-accent-soft"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Wiki
                      </a>
                    </div>

                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                        smsOn
                          ? "border-accent/35 bg-accent-soft/50 ring-1 ring-accent/20"
                          : "border-slate-100 bg-surface-muted/50 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <span className="font-medium text-ink">Include in SMS</span>
                      <input
                        type="checkbox"
                        checked={smsOn}
                        onChange={() => toggle(b.id)}
                        className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40"
                      />
                    </label>

                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 p-3 ring-1 ring-slate-200/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Weekly SMS
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <select
                          aria-label={`${name} reminder weekday`}
                          value={slot.weekday}
                          onChange={(e) =>
                            patchReminder(name, { weekday: Number(e.target.value) })
                          }
                          className="w-full min-w-0 flex-1 rounded-lg border border-slate-200/90 bg-white px-2 py-2 text-xs font-medium text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-auto"
                        >
                          {WEEKDAYS_LONG.map((label, value) => (
                            <option key={label} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          aria-label={`${name} reminder time`}
                          value={slot.time}
                          onChange={(e) => patchReminder(name, { time: e.target.value })}
                          className="w-full rounded-lg border border-slate-200/90 bg-white px-2 py-2 text-xs shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-auto sm:min-w-[7rem]"
                        />
                      </div>
                      <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-600">
                        <span className="text-ink-muted">Next </span>
                        <span className="tabular-nums">{formatNextLocalMonthDateTime(nextAt)}</span>
                        <span className="text-ink-muted"> (local) · UTC </span>
                        <span
                          className="tabular-nums"
                          title="Same reminder moment, shown in Coordinated Universal Time (uses your device timezone when building the time)."
                        >
                          {formatUtcFromLocalInstant(nextAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <BossVisibilityModal
        open={visibilityModalOpen}
        onClose={() => setVisibilityModalOpen(false)}
        allBossNames={allBossNames}
        visible={bossVisibility}
        onSave={handleSaveBossVisibility}
      />

      <SubscribeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        schedules={schedulesPayload}
      />

      <SmsSlotsSummaryModal
        open={smsSummaryOpen}
        onClose={() => setSmsSummaryOpen(false)}
        schedules={schedulesPayload}
      />

      <footer className="border-t border-slate-200/80 bg-white/50 py-10 text-center text-xs leading-relaxed text-ink-muted">
        <p className="mx-auto max-w-lg">
          Fan-made helper — not affiliated with Nexon. Boss portraits come only from images you add
          under <code className="rounded bg-slate-100 px-1 py-0.5">src/pic</code> (see{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">src/pic/README.md</code>); game
          requirements differ by region and patch.
        </p>
      </footer>
    </div>
  );
}

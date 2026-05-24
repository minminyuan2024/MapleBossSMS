"use client";

import { useEffect, useState } from "react";
import type { BossScheduleInput } from "@/lib/validation";
import { WIKI_BOSS_LIST_URL } from "@/lib/bosses";

const STORAGE_KEY = "mapleBossNotifySubscriptionId";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function weekdayLabel(v: number): string {
  return WEEKDAYS.find((d) => d.value === v)?.label ?? String(v);
}

type Props = {
  open: boolean;
  onClose: () => void;
  schedules: BossScheduleInput[];
};

export function SubscribeModal({ open, onClose, schedules }: Props) {
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTimezone("UTC");
    }
    setMessage(null);
    setError(null);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const subscriptionId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY) ?? undefined
          : undefined;
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          timezone,
          schedules,
          subscriptionId: subscriptionId || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        subscriptionId?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.subscriptionId) {
        window.localStorage.setItem(STORAGE_KEY, data.subscriptionId);
      }
      setMessage(
        "Saved. SMS delivery still needs Twilio + a cron hitting /api/cron/send-reminders (see README).",
      );
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-surface-card shadow-modal ring-1 ring-slate-200/80">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 id="subscribe-title" className="font-display text-xl font-semibold text-ink">
            SMS subscription
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            One weekly text per boss at the day/time you set on each card. Uses your timezone
            below.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex max-h-[calc(90vh-8rem)] flex-col">
          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="phone">
                Mobile number (E.164)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-accent/0 transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                required
              />
              <p className="mt-1 text-xs text-ink-muted">
                Include country code with +. Example: +1 for US/Canada.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-ink" htmlFor="tz">
                Timezone
              </label>
              <input
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                placeholder="America/New_York"
                required
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-surface-muted/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Reminders ({schedules.length} boss{schedules.length === 1 ? "" : "es"})
              </p>
              {schedules.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">
                  Turn on “Include in SMS” on at least one boss card to include it.
                </p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-sm text-ink">
                  {schedules.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-slate-100 bg-white/80 px-2 py-2"
                    >
                      <div className="font-medium">{s.bossName}</div>
                      <div className="text-xs text-ink-muted">
                        {weekdayLabel(s.reminderWeekday)} · {s.reminderTimeLocal}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-100">
                {message}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-muted hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={busy || schedules.length === 0}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save subscription"}
            </button>
          </div>

          <p className="px-6 pb-4 text-center text-[11px] text-ink-muted">
            Boss list from{" "}
            <a className="font-medium text-accent hover:underline" href={WIKI_BOSS_LIST_URL}>
              MapleStory Wiki — Major Bosses
            </a>
            . Boss portraits use files you add under <span className="font-mono">src/pic</span>.
          </p>
        </form>
      </div>
    </div>
  );
}

"use client";

import type { BossScheduleInput } from "@/lib/validation";
import { countDistinctReminderSlots } from "@/lib/reminders";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekdayLabel(v: number): string {
  return WEEKDAYS[v] ?? `Day ${v}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  schedules: BossScheduleInput[];
};

export function SmsSlotsSummaryModal({ open, onClose, schedules }: Props) {
  if (!open) return null;

  const slotCount = countDistinctReminderSlots(schedules);
  const bossCount = schedules.length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sms-summary-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface-card shadow-modal ring-1 ring-slate-200/80">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="sms-summary-title" className="font-display text-lg font-semibold text-ink">
            SMS subscription summary
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Bosses with <strong className="font-medium text-ink">Include in SMS</strong> on, and the
            weekly local reminder time used when you save your phone number.
            {bossCount > 0 ? (
              <>
                {" "}
                <span className="text-ink">
                  {bossCount} boss{bossCount === 1 ? "" : "es"} · {slotCount} time slot
                  {slotCount === 1 ? "" : "s"}.
                </span>
              </>
            ) : null}
          </p>
        </div>

        {schedules.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">No SMS slots yet</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Turn on <strong className="font-medium text-ink">Include in SMS</strong> on one or
              more boss cards below, then use <strong className="font-medium text-ink">Subscribe for SMS</strong> to save your number.
            </p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 px-5 py-2">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-sm font-semibold text-ink">{s.bossName}</span>
                <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                  {weekdayLabel(s.reminderWeekday)} · {s.reminderTimeLocal}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-100 px-5 py-4 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

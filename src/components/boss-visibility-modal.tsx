"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_VISIBLE_BOSS_NAMES } from "@/lib/boss-visibility-cookie";

type Props = {
  open: boolean;
  onClose: () => void;
  /** All boss names (sorted for display) */
  allBossNames: string[];
  /** Currently visible names */
  visible: Set<string>;
  onSave: (next: Set<string>) => void;
};

export function BossVisibilityModal({
  open,
  onClose,
  allBossNames,
  visible,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Set<string>>(visible);

  useEffect(() => {
    if (open) setDraft(new Set(visible));
  }, [open, visible]);

  const sorted = useMemo(() => [...allBossNames].sort((a, b) => a.localeCompare(b)), [allBossNames]);

  function toggle(name: string) {
    setDraft((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  function selectDefault() {
    const roster = new Set(allBossNames);
    const next = new Set<string>();
    for (const n of DEFAULT_VISIBLE_BOSS_NAMES) {
      if (roster.has(n)) next.add(n);
    }
    setDraft(next);
  }

  function selectAll() {
    setDraft(new Set(allBossNames));
  }

  function clearAll() {
    setDraft(new Set());
  }

  function done() {
    onSave(draft);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-vis-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface-card shadow-modal ring-1 ring-slate-200/80">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="boss-vis-title" className="font-display text-lg font-semibold text-ink">
            Bosses to show
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Uncheck a boss to hide it from the roster. Your choice is saved in a browser cookie. If
            you clear cookies, the roster starts with a small late-game default set again until you
            change it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-2">
          <button
            type="button"
            onClick={selectDefault}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
          >
            Select default
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-slate-50"
          >
            Clear all
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {sorted.map((name) => (
            <li key={name} className="border-b border-slate-50 last:border-0">
              <label className="flex cursor-pointer items-center gap-3 px-2 py-2.5 hover:bg-slate-50/80">
                <input
                  type="checkbox"
                  checked={draft.has(name)}
                  onChange={() => toggle(name)}
                  className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40"
                />
                <span className="text-sm font-medium text-ink">{name}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-muted hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={done}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
          >
            Save ({draft.size} shown)
          </button>
        </div>
      </div>
    </div>
  );
}

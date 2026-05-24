"use client";

import { useState, type ReactNode } from "react";

type Props = {
  bossName: string;
  /** `undefined` = not loaded yet; `null` = wiki has no thumbnail; string = image URL */
  imageUrl: string | null | undefined;
  wikiUrl: string;
};

/**
 * Native <img> + no-referrer avoids common hotlink / Next Image issues with wiki CDN.
 */
export function BossPortrait({ bossName, imageUrl, wikiUrl }: Props) {
  const [broken, setBroken] = useState(false);

  let body: ReactNode;
  if (imageUrl === undefined) {
    body = (
      <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Loading portrait…
        </span>
      </div>
    );
  } else if (imageUrl && !broken) {
    body = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={bossName}
        className="absolute inset-0 h-full w-full object-contain p-2"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  } else {
    body = (
      <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-1 p-4 text-center">
        <span className="font-display text-2xl font-bold text-slate-400">
          {bossName.slice(0, 2).toUpperCase()}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {broken ? "Could not load image" : "No image in src/pic"}
        </span>
      </div>
    );
  }

  return (
    <a
      href={wikiUrl}
      target="_blank"
      rel="noreferrer"
      className="relative block aspect-[4/3] w-full min-h-[140px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/80"
      title={`${bossName} — wiki`}
    >
      {body}
    </a>
  );
}

import { NextResponse } from "next/server";

type WikiPage = {
  title?: string;
  missing?: boolean;
  thumbnail?: { source: string };
};

type WikiQuery = {
  query?: {
    pages?: Record<string, WikiPage>;
  };
};

/** Slugs in our JSON may be path-encoded (e.g. Malitia). Wiki `titles=` expects decoded UTF-8. */
function wikiTitleFromSlug(slug: string): string {
  try {
    return decodeURIComponent(slug.replace(/\+/g, " "));
  } catch {
    return slug;
  }
}

function normTitle(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().trim();
}

async function fetchThumbnailsForTitles(
  originalSlugs: string[],
): Promise<Record<string, string | null>> {
  const images = new Map<string, string | null>();

  const body = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    pithumbsize: "400",
    titles: originalSlugs.map((s) => wikiTitleFromSlug(s)).join("|"),
  });

  const res = await fetch("https://maplestorywiki.net/api.php", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    next: { revalidate: 86_400 },
  });

  if (!res.ok) {
    throw new Error(`Wiki HTTP ${res.status}`);
  }

  const json = (await res.json()) as WikiQuery;
  const pages = json.query?.pages ?? {};

  for (const page of Object.values(pages)) {
    if (!page.title || page.missing) continue;
    images.set(page.title, page.thumbnail?.source ?? null);
  }

  const out: Record<string, string | null> = {};
  for (const slug of originalSlugs) {
    const requested = wikiTitleFromSlug(slug);
    let url = images.get(requested) ?? null;
    if (url === null) {
      const nr = normTitle(requested);
      for (const [wikiTitle, u] of images) {
        if (normTitle(wikiTitle) === nr) {
          url = u;
          break;
        }
      }
    }
    out[slug] = url;
  }
  return out;
}

const CHUNK = 12;

/**
 * Batch-resolve boss page thumbnails from MapleStory Wiki (MediaWiki pageimages).
 * POST JSON: { "titles": ["Zakum", "Magnus/Monster", ...] }
 * Keys in `images` match the request strings exactly (your catalog slugs).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const titles = (body as { titles?: unknown }).titles;
  if (!Array.isArray(titles) || titles.some((t) => typeof t !== "string")) {
    return NextResponse.json({ error: "Expected { titles: string[] }." }, { status: 400 });
  }

  const clean = [...new Set(titles.map((t) => t.trim()).filter(Boolean))].slice(0, 80);
  if (clean.length === 0) {
    return NextResponse.json({ images: {} as Record<string, string | null> });
  }

  try {
    const merged: Record<string, string | null> = {};
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK);
      const part = await fetchThumbnailsForTitles(chunk);
      Object.assign(merged, part);
    }

    /** Many bosses use `Name/Monster` in our catalog; `pageimages` often only has a file on `Name`. */
    const slugToParent = new Map<string, string>();
    const parentTitles = new Set<string>();
    for (const slug of clean) {
      if (merged[slug]) continue;
      const wt = wikiTitleFromSlug(slug);
      if (!wt.includes("/")) continue;
      const parent = wt.split("/")[0]!.trim();
      if (!parent) continue;
      slugToParent.set(slug, parent);
      parentTitles.add(parent);
    }
    if (parentTitles.size > 0) {
      const parents = [...parentTitles];
      for (let i = 0; i < parents.length; i += CHUNK) {
        const chunk = parents.slice(i, i + CHUNK);
        const part = await fetchThumbnailsForTitles(chunk);
        for (const slug of clean) {
          const p = slugToParent.get(slug);
          if (p && !merged[slug] && part[p]) {
            merged[slug] = part[p];
          }
        }
      }
    }

    return NextResponse.json({ images: merged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Wiki error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

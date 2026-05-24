import { NextResponse } from "next/server";
import { getMajorBosses } from "@/lib/bosses";
import { buildWikiSlugToAbsPathMap, getBossPicDir } from "@/lib/local-boss-pic-resolve";

/**
 * JSON map: catalog `wikiSlug` → image URL under `/api/local-boss-pic`.
 * Used by the client to prefer files in `src/pic` over wiki thumbnails.
 */
export async function GET() {
  const bosses = getMajorBosses();
  const map = buildWikiSlugToAbsPathMap(bosses, getBossPicDir());
  const body: Record<string, string> = {};
  for (const wikiSlug of map.keys()) {
    body[wikiSlug] = `/api/local-boss-pic?slug=${encodeURIComponent(wikiSlug)}`;
  }
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getMajorBosses } from "@/lib/bosses";
import { buildWikiSlugToAbsPathMap, getBossPicDir } from "@/lib/local-boss-pic-resolve";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug query parameter." }, { status: 400 });
  }

  const bosses = getMajorBosses();
  if (!bosses.some((b) => b.wikiSlug === slug)) {
    return NextResponse.json({ error: "Unknown boss slug." }, { status: 404 });
  }

  const map = buildWikiSlugToAbsPathMap(bosses, getBossPicDir());
  const abs = map.get(slug);
  if (!abs) {
    return NextResponse.json({ error: "No image in src/pic for this boss." }, { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";

  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not read image file." }, { status: 500 });
  }
}

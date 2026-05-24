import fs from "fs";
import path from "path";
import type { MajorBossEntry } from "@/lib/bosses";

const PIC_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

function slugifyAscii(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Strings a user might use as a filename stem (without extension) for this boss.
 */
export function bossPicMatchStrings(b: MajorBossEntry): string[] {
  const decoded = safeDecode(b.wikiSlug);
  const firstSeg = decoded.includes("/") ? decoded.split("/")[0]! : decoded;
  const noMonster = decoded.replace(/\/Monster$/i, "");
  const baseName = noMonster.includes("/")
    ? noMonster.split("/").pop()!
    : noMonster;

  const out: string[] = [
    b.id,
    b.bossName,
    slugifyAscii(b.bossName),
    b.wikiSlug,
    decoded,
    decoded.replace(/\//g, "__"),
    decoded.replace(/\//g, "-"),
    decoded.replace(/\//g, ""),
    firstSeg,
    firstSeg.replace(/_/g, "-"),
    firstSeg.replace(/_/g, " "),
    baseName,
    baseName.replace(/_/g, "-"),
    baseName.replace(/_/g, " "),
    noMonster.replace(/\//g, "-"),
    slugifyAscii(decoded.replace(/\//g, " ")),
    // Maple asset-style names (e.g. Mob_Chosen_Seren.png)
    `Mob_${firstSeg}`,
    `Mob_${decoded.replace(/\//g, "_")}`,
  ];
  if (decoded.toLowerCase().includes("/monster")) {
    out.push(`${firstSeg}_Monster`);
    out.push(`${firstSeg}-Monster`);
    out.push(`${firstSeg}Monster`);
    out.push(`Mob_${firstSeg}_Monster`);
  }
  // Wiki / asset strings sometimes drop the "n" in "Chosen" (Mob_Chose_Seren…)
  if (/^Chosen/i.test(firstSeg)) {
    out.push(firstSeg.replace(/^Chosen/i, "Chose"));
    out.push(`Mob_${firstSeg.replace(/^Chosen/i, "Chose")}`);
  }
  return [...new Set(out.map((x) => x.trim()).filter(Boolean))];
}

/** Strip Mob_/NPC_ style prefixes and trailing difficulty tokens from asset filenames. */
function assetStemVariants(fileStem: string): string[] {
  const t = fileStem.trim();
  const out = new Set<string>([t]);
  let cur = t;
  const stripMob = cur.replace(/^(?:mob|npc|mapobj)_/i, "");
  if (stripMob !== cur) {
    out.add(stripMob);
    cur = stripMob;
  }
  const noMonsterStem = cur.replace(/_monster$/i, "");
  if (noMonsterStem !== cur) {
    out.add(noMonsterStem);
    cur = noMonsterStem;
  }
  const noDiff = cur.replace(
    /_(?:normal|easy|hard|chaos|extreme|story|solo)(?:_\d+)?$/i,
    "",
  );
  if (noDiff !== cur) out.add(noDiff);
  return [...out];
}

function stemMatches(fileStem: string, b: MajorBossEntry): boolean {
  const stems = assetStemVariants(fileStem);
  const cands = bossPicMatchStrings(b);

  for (const stem of stems) {
    if (!stem) continue;
    const lower = stem.toLowerCase();
    const stemUnders = lower.replace(/-/g, "_");

    for (const cand of cands) {
      const c = cand.trim();
      if (!c) continue;
      if (stem === c) return true;
      if (lower === c.toLowerCase()) return true;
      if (stemUnders === c.toLowerCase().replace(/-/g, "_")) return true;
      if (slugifyAscii(c) === slugifyAscii(stem) && slugifyAscii(stem).length > 0)
        return true;
    }

    // e.g. Mob_Kalos_Hard → segments mob, kalos, hard — matches id "kalos"
    const segList = lower
      .replace(/_/g, "-")
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const idParts = b.id
      .toLowerCase()
      .split("-")
      .filter((p) => p.length >= 3);
    const allPartsInStem =
      idParts.length > 0 && idParts.every((p) => segList.includes(p));
    const allowSegMatch =
      allPartsInStem &&
      (idParts.length >= 2 ||
        (idParts.length === 1 && idParts[0]!.length >= 5));
    if (allowSegMatch) return true;
  }
  return false;
}

export function getBossPicDir(): string {
  return path.join(process.cwd(), "src", "pic");
}

/** wikiSlug (catalog key) → absolute path on disk */
export function buildWikiSlugToAbsPathMap(
  bosses: MajorBossEntry[],
  picDir: string,
): Map<string, string> {
  const map = new Map<string, string>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(picDir).filter((n) => PIC_EXT.test(n));
  } catch {
    return map;
  }
  files.sort((a, b) => {
    const la = path.parse(a).name.length;
    const lb = path.parse(b).name.length;
    if (lb !== la) return lb - la;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });

  const used = new Set<string>();
  for (const b of bosses) {
    const hit = files.find((f) => !used.has(f) && stemMatches(path.parse(f).name, b));
    if (hit) {
      map.set(b.wikiSlug, path.join(picDir, hit));
      used.add(hit);
    }
  }
  return map;
}

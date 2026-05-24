# Boss images (`src/pic`)

The home page **only** uses images from this folder (served via `/api/local-boss-pic`). There is **no** wiki or other remote portrait URL in the app.

Drop image files here: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`. The app matches **filename without extension** to the roster using, in order:

- Catalog **`id`** (e.g. `chosen-seren.png`)
- **`bossName`** or a slugified form (`chosen-seren`, `Chosen_Seren`, …)
- **Wiki title** variants from `major-bosses.json` (`Zakum`, `Will/Monster`, `Giant_Monster_Gloom`, …), with `/` as `-` or `__`, and `/Monster` stripped where relevant; also forms like `Kalos_Monster`, `Mob_Kalos_Monster`
- **Game-style names**: leading `Mob_`, `NPC_`, or `MapObj_` is ignored for matching (e.g. `Mob_Chosen_Seren.png`, `Mob_Chose_Seren_Normal.png`). A trailing `_Normal`, `_Hard`, `_Chaos`, etc. is stripped before matching. A trailing `_Monster` on the stem is stripped too (e.g. `Mob_Baldrix_Monster.png` → `Baldrix`).
- **Segment match**: if the filename splits into tokens like `mob`, `kalos`, `hard`, it still matches catalog id `kalos` (every hyphen-separated id part ≥3 letters appears as its own token).

Examples: `zakum.png`, `Chosen_Seren.jpg`, `Mob_Chosen_Seren.png`, `Mob_Kalos.png`, `Will-Monster.webp`, `gloom.png` (for Gloom / Giant Monster Gloom).

If two files match the same boss, the **longest filename** is preferred, then alphabetical order. Unmatched files are ignored.

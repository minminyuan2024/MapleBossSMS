# Maple Boss Notify

Light, modern web UI to **subscribe** to **weekly SMS reminders** for MapleStory **Major Bosses**, aligned with the [MapleStory Wiki — Bosses (Major Bosses)](https://maplestorywiki.net/w/Bosses#Major_Bosses) table (one configurable reminder per boss). The UI’s **SMS slots** count is the number of **distinct** local weekday + time combinations among bosses with SMS enabled.

This is a **fan-made helper** and is not affiliated with Nexon.

## Features

- **Modern layout** with a soft light background, subtle grid, and modal-style subscription flow.
- **Boss cards** with **name**, **portrait** (only from images in `src/pic`; see `src/pic/README.md`), **per-boss weekday + time** (e.g. Sunday 8:00 p.m.), and an **include in SMS** toggle per card.
- **Subscriptions** stored on disk (`.data/subscriptions.json`) — one record per phone with an array of **per-boss schedules** (each with its own weekly SMS time).
- **Boss roster filter** (cookie `maple_boss_visible`): pick which bosses appear; first visit defaults to **Chosen Seren, Kalos, First Adversary, Kaling, Malefic Star, Limbo, Baldrix, Jupiter**; “select all” persists as `["*"]`; “select default” + Save persists as `["__default__"]` so that exact default set reloads; any other saved list is shown as-is (new roster names are not auto-added).

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and fill Twilio values when you are ready to send real SMS.

## Boss pictures

### Portraits on the site (`src/pic` only)

The roster **only** loads images from **`src/pic/`** (see `src/pic/README.md` for naming). There is no live wiki or `public/boss-portraits` fallback in the UI.

### Optional: download script (wiki thumbnails to disk)

If you want wiki thumbnails as files for another use, you can still run:

```bash
npm run download-portraits
```

If you see `unable to verify the first certificate`, your network may be intercepting TLS (corporate proxy). On a **trusted** machine only, you can try:

```bash
set MAPLE_WIKI_INSECURE_TLS=1
npm run download-portraits
```

(PowerShell: `$env:MAPLE_WIKI_INSECURE_TLS='1'; npm run download-portraits`)

If the wiki returns **403**, try again from a normal home connection; some automated environments are blocked.

Attribute **MapleStory Wiki** in your UI; images are typically **CC BY-SA**.

## SMS (Twilio)

1. Create a [Twilio](https://www.twilio.com/) account and buy / verify a phone number **or** create a **Messaging Service**.
2. Set in `.env.local`:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - **Either** `TWILIO_MESSAGING_SERVICE_SID` **or** `TWILIO_FROM_NUMBER` (E.164)

3. Set `CRON_SECRET` to a long random string to protect cron routes.

### Test SMS (optional)

```bash
curl -X POST "http://localhost:3000/api/cron/test-sms" ^
  -H "Authorization: Bearer YOUR_CRON_SECRET" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"+15551234567\"}"
```

(PowerShell users: replace line endings or use `curl.exe` with proper quoting.)

### Weekly reminders

**In this repo, scheduled cron routes are temporarily stubbed** (`503` from `/api/cron/*`) and `vercel.json` has no `crons` entry. To turn them back on, restore `vercel.json` and uncomment the handlers in `src/app/api/cron/send-reminders/route.ts` and `test-sms/route.ts`.

The app sends **at most one SMS per boss schedule per local calendar day** when:

- the subscriber’s **local weekday** matches that schedule’s chosen day, and  
- the current local time is within **±25 minutes** of the chosen `HH:mm` (so an hourly cron still hits the window).

If several bosses are due in the same cron tick, they are **combined into a single SMS** for that phone. Bosses that share the **same weekday and local time** appear under one heading in that message (still one Twilio send per subscription per tick).

Trigger from your scheduler (example):

```http
GET /api/cron/send-reminders
Authorization: Bearer YOUR_CRON_SECRET
```

On **Vercel**, add `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "30 * * * *"
    }
  ]
}
```

Ensure `CRON_SECRET` is set in the project environment, and configure Vercel Cron to send the `Authorization` header (or extend the route to accept a query param you prefer — the code already supports `?secret=` as an alternative).

## Production notes

- **Persistence**: `.data/subscriptions.json` is fine for demos; use Postgres / Dynamo / KV for real traffic.
- **Compliance**: SMS to real users requires consent, STOP handling, and carrier compliance — Twilio’s docs cover A2P 10DLC / registration where applicable.
- **Accuracy**: Weekly reset rules differ by region and patch; this tool is a **reminder checklist**, not a live game API.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS

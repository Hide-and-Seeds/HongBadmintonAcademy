# HBA — Operations guide

How Hong Badminton Academy runs day to day: what happens automatically, what an
admin does by hand, where every button is, and what has to stay switched on for
messaging to work.

> Times: Vercel Cron runs in **UTC**. Malaysia is **UTC+8 (MYT)**. Both shown below.

---

## 1. Automated (no clicks)

| Job | Schedule (UTC) | MYT | What it does |
|-----|----------------|-----|--------------|
| `flag-absences` | `0 16 * * *` | 00:00 daily | Closes finished sessions, marks late tap-ins + absentees |
| `enqueue-reminders` | `0 1 * * *` | 09:00 daily | Queues fee reminders (before-due, due, overdue 3/7/14/28) for unpaid invoices |
| `generate-scorecards` | `0 2 * * *` | 10:00 daily | Acts only on the admin-set **report day**: builds the previous month's Growth Report PDF per active student + posts the Community notice |
| `generate-invoices` | `0 3 * * *` | 11:00 daily | Acts only on the admin-set **invoice day**: raises this month's fee invoice per student on a monthly plan (due on the **due day**), then posts the combined Community notice |
| `backup` | `0 18 * * *` | 02:00 daily | JSON snapshot of every table to the private `backups` bucket |
| Stripe webhook | on payment | — | Marks the invoice paid + records the payment |
| DB triggers | on write | — | New auth user → profile row; invoice number; `updated_at` |
| WhatsApp worker | continuous | 09:00–20:00 | Drip-sends everything queued (fee reminders 1:1 + Community posts) |

Crons live in [`vercel.json`](vercel.json); each route is under `src/app/api/cron/*`
and is protected by `CRON_SECRET`.

### The combined Community notice
On the 1st, after invoices are raised, **one** privacy-safe post goes to the
parent WhatsApp Community: "Growth Reports ready + this month's fees issued — log
in". It adapts to what actually ran (combined / reports-only / fees-only) and is
posted once per month. No child names, scores, or amounts ever go to the
Community.

---

## 2. The WhatsApp worker (the thing that actually sends)

WhatsApp messages are sent by an always-on worker (`wa-worker/server.mjs`,
`whatsapp-web.js`) running on a separate VM — **not** Vercel. The crons only
**queue** messages; the worker polls and sends them under a cautious anti-ban
policy:

- **window, daily cap and min-gap are admin-set** in Settings → Send schedule
  (defaults: 09:00–20:00 MYT, ≤ 10/day, ≥ 10-min gap)
- ~30% of polls skipped at random (fixed), polls every 8–15 minutes
- changes apply on the worker's next poll — no redeploy

**If the worker VM is down or logged out, nothing sends — messages just pile up
queued.** See §6 for running/recovering it.

---

## 3. Manual actions — where the buttons are

| Action | Where |
|--------|-------|
| Generate growth reports now | Admin → **Growth Reports** → "Generate this month" |
| Generate invoices now | Admin → **Invoices & Payments** → "Generate this month" |
| Post a free-text Community message (holiday greeting, schedule change) | Admin → **Announcements** → "Post to Community" |
| Pause / resume the whole worker | Admin → **Settings** → WhatsApp worker |
| Park / resume auto fee reminders only | Admin → **Settings** → Auto fee reminders |
| Set invoice / report / due **dates** (day of month) | Admin → **Settings** → Monthly schedule |
| Set send window / daily cap / min gap | Admin → **Settings** → Send schedule |
| Mark an invoice paid | Invoices → row → "Mark paid" |
| Create a one-off invoice | Invoices → "+ New invoice" |
| Assign a monthly fee plan to a student | People → edit student → "Monthly fee plan" |
| Send ONE report to ONE parent (fallback) | Growth Reports → row → WhatsApp button |
| Remind ONE parent about an invoice (fallback) | Invoices → row → "Remind" |

The manual "Generate this month" buttons run the **same** code as the monthly
crons and are idempotent — clicking twice will not double-bill or double-post.

---

## 4. Switches (Settings page)

Two independent kill switches, stored in the `app_settings` table:

- **Pause worker** — stops *all* sending (reminders, reports, announcements).
  Everything stays queued and resumes when un-paused.
- **Park auto fee reminders** — stops *only* fee reminders (new ones aren't
  queued; already-queued ones are held). Growth reports & announcements still
  send. Use this to hold off chasing parents without silencing everything.

---

## 5. What is NOT automated (by design)

- **Coach marking / assessments** — entered by hand; they feed the growth reports.
- **Per-parent report delivery** — replaced by the single Community notice. The
  per-row WhatsApp buttons remain as a manual fallback.

---

## 6. Running the worker (VM)

The worker is a `pm2` process (`hba-wa`) inside a full clone of this repo on the
VM. Common tasks (run on the VM over SSH):

```bash
# update + restart after a code change
cd ~/HongBadmintonAcademy && git pull && pm2 restart hba-wa

# logs / liveness
pm2 logs hba-wa --lines 30
curl -s http://localhost:8787/health            # {"ready":true} when logged in

# load the worker secret from its .env (for the calls below)
set -a; . ~/HongBadmintonAcademy/wa-worker/.env; set +a

# list groups/communities (to find a group chat id)
curl -s -H "Authorization: Bearer $WA_WORKER_SECRET" http://localhost:8787/groups

# send a test message (number or group chat id)
curl -s -X POST http://localhost:8787/send \
  -H "Authorization: Bearer $WA_WORKER_SECRET" -H "Content-Type: application/json" \
  -d '{"to":"120363...@g.us","text":"test"}'
```

### Re-linking after a logout
If the number is unlinked (`Disconnected: LOGOUT` in logs), wipe the stale
session and re-scan:

```bash
pm2 stop hba-wa
rm -rf ~/HongBadmintonAcademy/wa-worker/.wwebjs_auth
pm2 start hba-wa
pm2 logs hba-wa            # scan the QR (or download wa-worker/qr.png)
```

Link with the **dedicated bot number** that is an **admin** of the Community
Announcements group — never a personal/main number (ban risk).

---

## 7. Configuration (env vars)

App (Vercel):

| Var | Purpose |
|-----|---------|
| `CRON_SECRET` | Authenticates Vercel Cron calls |
| `WA_WORKER_URL`, `WA_WORKER_SECRET` | App ↔ worker auth |
| `WA_COMMUNITY_GROUP_ID` | Community Announcements group chat id (`…@g.us`). **Required** for any Community post — without it, notices don't queue |
| `WA_COMMUNITY_LINK` | Optional invite link; only used by the manual paste fallback |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Online payments |

Worker (`wa-worker/.env`): `WA_WORKER_SECRET` (same as app), `APP_URL`, `PORT`
(8787), optional `CHROME_PATH`.

---

## 8. Requirements & gotchas

- **Worker VM up + logged in**, or nothing sends.
- **`WA_COMMUNITY_GROUP_ID` set** and the bot number is a **group admin**, or
  Community posts fail / don't queue.
- **Parents need a phone** (E.164, `+60…`) on their profile for 1:1 fee reminders.
- **Add real parents to the Community** — notices only reach group members.
- Privacy: never put names, scores, or amounts in a Community post — it's visible
  to all parents. Per-child detail lives in the parent portal only.

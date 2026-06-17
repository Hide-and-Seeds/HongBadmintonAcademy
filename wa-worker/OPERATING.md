# HBA WhatsApp Bot — Operating Notes

Auto-send WhatsApp messages (score cards, fee reminders) from the HBA site using an
**unofficial** whatsapp-web.js bot. This is the run-book.

## How it fits together
```
[hong-badminton-academy.vercel.app]  --HTTPS + bearer secret-->  [GCP worker, always-on]  -->  WhatsApp Web  -->  parent
```
- **App** (Vercel, Next.js): sends via `getWhatsappProvider()` whenever `WA_WORKER_URL` + `WA_WORKER_SECRET` env vars are set.
- **Worker** (GCP e2-micro, Debian): `~/HongBadmintonAcademy/wa-worker`, run by **pm2** as process **`hba-wa`**. User: `leoric_kingdom`.
- **Public URL** (Tailscale Funnel → localhost:8787): `https://hba-wa.tail9ab5d1.ts.net`
- **Linked number**: the dedicated SIM — this is the account that *sends*, and the one that carries the ban risk.

## Day-to-day
Nothing to do. Admin → **Score Cards** / **Invoices** → **"Send via bot"** (auto). The **"Send on WhatsApp"** (wa.me) button is the manual fallback if the bot is down.

## Auto-reminders (fee reminders)
Fully automatic, throttled to stay under Meta's radar:
- A **daily** job queues a reminder for invoices **due in 3 days** and **due today** that are still unpaid (auto-cancels the moment it's paid).
- The worker **drip-sends**: daytime only (**9am–8pm MYT**), **≤10/day**, **≥10-min gaps**, randomised order + occasional skips — never a mass blast.
- Toggle: set/unset **`APP_URL`** in `wa-worker/.env` (then `pm2 restart hba-wa`). Unset = auto-reminders paused; manual buttons still work.
- Score cards are **not** auto-sent — use the manual "Send via bot" button.
- Queue lives in the `message_queue` table; delivered ones also show in the **WhatsApp Log**.

## Health check
Open `https://hba-wa.tail9ab5d1.ts.net/health` → expect `{"ready":true}`.
> After any worker reboot it takes **~2–3 min** to reach `ready` (slow free CPU). Not broken — just wait.

## If a send fails
1. Check `/health` above. If `ready:false`, wait 2–3 min and retry.
2. Still down → GCP console → SSH into the VM, then:
   ```bash
   cd ~/HongBadmintonAcademy/wa-worker
   pm2 restart hba-wa
   pm2 logs hba-wa --lines 30 --nostream
   ```
3. Every failure is recorded in the app's **WhatsApp Log** page with the exact error.

## Worker controls (on the VM, via SSH)
- Status: `pm2 list`
- Live logs: `pm2 logs hba-wa`
- Restart: `pm2 restart hba-wa`
- Auto-starts on VM reboot (already set via `pm2 startup` + `pm2 save`).

## Re-link the phone (lost session)
Three ways, easiest first. **B and C need the worker running the latest code** —
deploy once: `cd ~/HongBadmintonAcademy/wa-worker && git pull && pm2 restart hba-wa`.

**A — In the web app (no SSH, easiest).** Admin → **Settings → "Link WhatsApp (scan QR)"** → scan with the dedicated phone (WhatsApp → Linked devices → Link a device). Turns green when linked.

**B — Browser QR (no SSH).** Open on a laptop/2nd screen, then scan:
```
https://hba-wa.tail9ab5d1.ts.net/qr?secret=<WA_WORKER_SECRET>
```
> Use the **Tailscale Funnel URL above** — NOT `http://<vm-ip>:8787` (port 8787 isn't open publicly; the funnel is the only way in).

**C — SSH (always works).**
```bash
cd ~/HongBadmintonAcademy/wa-worker
pm2 restart hba-wa
pm2 logs hba-wa            # scan the QR; or ⚙ Download file → wa-worker/qr.png and scan that
```
For a brand-new number, wipe the old session first: `rm -rf .wwebjs_auth .wwebjs_cache` before the restart.
Wait for `WhatsApp client READY` either way.

## If the number gets BANNED (cold-swap recovery)
1. New SIM → phone → install WhatsApp → register that number (OTP).
2. On the VM, run the helper: `bash ~/HongBadmintonAcademy/wa-worker/relink.sh`
   — it wipes the old session, restarts, and shows a QR. Scan with the new number; wait for `WhatsApp client READY`.
3. Nothing else changes — same worker, same URL, same Vercel env. Back in minutes.

## Secrets — keep private, never commit
- `wa-worker/.env` — `WA_WORKER_SECRET`, `PORT`, `CHROME_PATH`.
- `wa-worker/.wwebjs_auth/` — the logged-in session; anyone with it controls the number.
- Vercel env `WA_WORKER_URL` + `WA_WORKER_SECRET` must **match** the worker's `.env`.
- Rotate the secret: change it in `wa-worker/.env` (`pm2 restart hba-wa`) **and** Vercel (redeploy) — they must match.

## Golden rules (stay unbanned)
- Unofficial bot → Meta can ban the number anytime. **Never mass-blast.**
- Dedicated SIM only — never the academy's main number.
- Keep the phone powered + occasionally online so the linked device stays alive.

## Key facts
- VM: GCP e2-micro, Debian 12, Always-Free region (us-central1/us-west1/us-east1).
- Tunnel: Tailscale Funnel → `https://hba-wa.tail9ab5d1.ts.net`.
- Repo: `github.com/leorickingdom-source/HongBadmintonAcademy` (worker lives in `/wa-worker`).
- Use the **canonical** Vercel URL `hong-badminton-academy.vercel.app` — the `-<hash>-` deployment URLs are frozen to old builds.

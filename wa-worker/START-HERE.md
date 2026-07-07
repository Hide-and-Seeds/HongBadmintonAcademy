# WhatsApp Sender — Start Here

Simple setup for the computer that sends the academy's WhatsApp messages.
About 10 minutes. No tech knowledge needed.

---

## Before you start
- The computer needs **Google Chrome** installed. (If not: go to **google.com/chrome**.)
- Have the **academy WhatsApp phone** (the dedicated SIM) next to you.
- Have the **secret code** ready (ask whoever set up the website).

---

## Set it up (do this once)

1. Copy the **`wa-worker`** folder onto the computer (the Desktop is fine).

2. Open that folder. Double-click **`setup-client.bat`**.
   → A black window opens and sets things up. Just wait.

3. When it asks for the **Secret**, paste the secret code and press **Enter**.

4. A **QR code** opens in the web browser. On the academy phone:
   **WhatsApp → Settings → Linked Devices → Link a Device → scan the QR.**

5. Wait until it says **connected**. ✅ Done — messages now send by themselves.

---

## Keep it working (important)
- **Leave the computer switched ON.** Don't shut it down.
- Stop it sleeping: **Settings → Power → Sleep → Never.**

---

## If it stops working — just redo it
1. Double-click **`clean-uninstall.bat`** → press a key to confirm.
2. Double-click **`setup-client.bat`** again.

It remembers the secret and the phone link, so usually there's **no typing and no re-scan** — it just fixes itself.

---

## Change the WhatsApp phone (new SIM)
Do it from the website, no need to touch this computer:
**Admin → Settings → Link WhatsApp → Disconnect & re-link → scan the new phone.**

---

## Check if it's working
On the website: **Admin → Settings → Link WhatsApp**.
- **Green / connected** = working.
- Not green = redo the two steps above ("If it stops working").

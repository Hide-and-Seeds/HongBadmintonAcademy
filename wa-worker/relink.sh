#!/usr/bin/env bash
# Cold-swap recovery — run after the bot number is banned, or to switch SIMs.
# Wipes the saved WhatsApp session and re-links a NEW number. Nothing else
# changes: same worker, same URL, same Vercel env.
#
# Usage:  bash relink.sh
set -e
cd "$(dirname "$0")"

echo ">>> Wiping current WhatsApp session (.wwebjs_auth / .wwebjs_cache)..."
rm -rf .wwebjs_auth .wwebjs_cache

echo ">>> Restarting the worker..."
pm2 restart hba-wa

echo ""
echo ">>> A QR will appear below in ~10-30s."
echo ">>> Scan it with the NEW number:  WhatsApp > Settings > Linked Devices > Link a device."
echo ">>> Press Ctrl+C once you see:  'WhatsApp client READY. Worker can send messages.'"
echo ""
sleep 3
pm2 logs hba-wa

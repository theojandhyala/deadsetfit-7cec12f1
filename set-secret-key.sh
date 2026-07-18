#!/bin/bash
cd "$(dirname "$0")" || exit 1
CFG="$(mktemp /tmp/ds.XXXXXX.jsonc)"
echo '{ "name": "deadset", "main": "./src/cloudflare-worker.ts", "compatibility_date": "2025-01-01" }' > "$CFG"
trap 'rm -f "$CFG"' EXIT

echo ""
echo "── DEADSET: set the NEW account SECRET KEY ──"
echo "Get it from: Stripe (deadset account, Live mode) → Developers → API keys"
echo "→ Create secret key → copy the sk_live_... value."
echo ""
echo "Paste the sk_live_ key and press Enter. Screen stays BLANK (normal)."
read -rs KEY
echo ""
case "$KEY" in
  sk_live_*) ;;
  pk_*) echo "That's a PUBLISHABLE key (pk_). You need the SECRET key (sk_live_). Nothing changed."; exit 1 ;;
  whsec_*) echo "That's the WEBHOOK secret (whsec_). You need the API SECRET key (sk_live_). Nothing changed."; exit 1 ;;
  "") echo "Nothing pasted. Nothing changed."; exit 1 ;;
  *) echo "That doesn't start with sk_live_. Nothing changed — copy the SECRET key and rerun."; exit 1 ;;
esac
printf '%s' "$KEY" | npx wrangler secret put STRIPE_LIVE_API_KEY --name deadset -c "$CFG" || { echo "Upload failed."; exit 1; }
unset KEY
echo "Uploaded. Waiting 15s for the edge..."
sleep 15
echo "Production check:"
curl -s https://deadsetfit.org/api/health/stripe
echo ""
echo "→ Tell Claude: done"

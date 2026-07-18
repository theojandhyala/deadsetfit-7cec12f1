#!/bin/bash
# One-shot Stripe key fixer for DEADSET checkout.
# Usage: bash fix-stripe-key.sh   → paste the NEW sk_live_ key when asked.
cd "$(dirname "$0")" || exit 1

echo ""
echo "── DEADSET checkout key fix ──"
echo "Paste your NEW Stripe secret key (starts sk_live_) and press Enter."
echo "The screen stays BLANK while you paste — that is normal, it is hiding it."
echo ""
read -rs KEY
echo ""

if [ -z "$KEY" ]; then
  echo "Nothing was pasted. Run it again: bash fix-stripe-key.sh"
  exit 1
fi
case "$KEY" in
  sk_live_*|rk_live_*) ;;
  *)
    echo "That does not look like a LIVE secret key (should start with sk_live_)."
    echo "Nothing was changed. Check you copied the right one and run it again."
    exit 1
    ;;
esac

echo "Uploading to the checkout server (Cloudflare)..."
# --name targets the Worker directly; the repo config also declares a Pages
# output dir, which otherwise makes `secret put` refuse as "a Pages project".
if ! printf '%s' "$KEY" | npx wrangler secret put STRIPE_LIVE_API_KEY --name deadset; then
  echo "Upload failed — run it again, or screenshot this window for Claude."
  exit 1
fi
unset KEY

echo "Waiting for the server to pick it up..."
sleep 8
echo "Checking production:"
RESULT=$(curl -s https://deadsetfit.org/api/health/stripe)
echo "$RESULT"
echo ""
case "$RESULT" in
  *'"valid"'*) echo "✅ CHECKOUT IS LIVE. Tell Claude: done" ;;
  *) echo "Still not valid — wait 30 seconds and run: curl -s https://deadsetfit.org/api/health/stripe" ;;
esac

#!/bin/bash
# One-shot Stripe key fixer for DEADSET checkout.
# Usage: bash fix-stripe-key.sh   → paste the NEW sk_live_ key when asked.
cd "$(dirname "$0")" || exit 1

# The repo's wrangler config carries a Pages output dir, which makes
# `wrangler secret put` refuse as "a Pages project". This minimal
# worker-only config forces Workers mode so the secret lands correctly.
CFG="$(mktemp /tmp/deadset-secret.XXXXXX.jsonc)"
cat > "$CFG" <<'EOF'
{ "name": "deadset", "main": "./src/cloudflare-worker.ts", "compatibility_date": "2025-01-01" }
EOF
trap 'rm -f "$CFG"' EXIT

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
    echo "Nothing was changed. Copy the right one and run it again."
    exit 1
    ;;
esac

echo "Uploading to the checkout server (Cloudflare)..."
if ! printf '%s' "$KEY" | npx wrangler secret put STRIPE_LIVE_API_KEY --name deadset -c "$CFG"; then
  echo "Upload failed — screenshot this window for Claude."
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
  *) echo "Not valid yet — wait 30s then run: curl -s https://deadsetfit.org/api/health/stripe" ;;
esac

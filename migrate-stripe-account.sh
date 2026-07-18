#!/bin/bash
# Migrate DEADSET's LIVE Stripe to the new dedicated "deadset" account.
# Uploads the new account's SECRET KEY and WEBHOOK SIGNING SECRET to the
# checkout server, then self-verifies. Publishable key + deploy are handled
# separately by Claude.
cd "$(dirname "$0")" || exit 1

CFG="$(mktemp /tmp/deadset-secret.XXXXXX.jsonc)"
cat > "$CFG" <<'EOF'
{ "name": "deadset", "main": "./src/cloudflare-worker.ts", "compatibility_date": "2025-01-01" }
EOF
trap 'rm -f "$CFG"' EXIT

put_secret() {
  local name="$1" prompt="$2" prefix="$3" value
  echo ""
  echo "── $prompt ──"
  echo "Paste it and press Enter. Screen stays BLANK while you paste (normal)."
  read -rs value
  echo ""
  if [ -z "$value" ]; then echo "Nothing pasted — skipping $name."; return 1; fi
  case "$value" in
    ${prefix}*) ;;
    *) echo "That doesn't start with '$prefix' — skipping $name so nothing breaks."; return 1 ;;
  esac
  printf '%s' "$value" | npx wrangler secret put "$name" --name deadset -c "$CFG" \
    && echo "✓ $name uploaded" || { echo "✗ $name upload failed"; return 1; }
}

echo "════ DEADSET → new dedicated Stripe account ════"
put_secret STRIPE_LIVE_API_KEY        "NEW account SECRET key (Stripe → Developers → API keys)" "sk_live_"
put_secret PAYMENTS_LIVE_WEBHOOK_SECRET "NEW account WEBHOOK signing secret (Stripe → Webhooks → your endpoint → Signing secret, starts whsec_)" "whsec_"

echo ""
echo "Waiting 15s for the edge to pick up the new secrets..."
sleep 15
echo "Checking production Stripe key:"
curl -s https://deadsetfit.org/api/health/stripe
echo ""
echo ""
echo "If it says \"valid\" → the new account's key is live. Tell Claude: done"
echo "If it still says FAILED → wait 30s and run: curl -s https://deadsetfit.org/api/health/stripe"

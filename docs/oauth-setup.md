# Google + Apple sign-in

DEADSET owns the public social-login entry point:
`https://deadsetfit.org/api/auth/<provider>/start`. The worker supports two
session paths:

1. **First-party session minting** verifies the provider `id_token`, creates or
   links the Supabase user with a valid service-role key, and redeems an admin
   magic link.
2. **Managed session fallback** is used for the current Lovable-managed
   Supabase project because Lovable does not expose that project's service-role
   key. The worker validates that a stored legacy key belongs to the configured
   project before selecting the first-party path. A mismatched key can therefore
   never send a user into a flow that fails after provider consent.

```
/auth/  →  deadsetfit.org/api/auth/google/start
        →  accounts.google.com/…
        →  verified first-party session OR managed Supabase session
        →  /auth/#access_token=…                  (web)
           /auth/native-callback#access_token=…   (iPhone → org.deadsetfit.app://auth/callback)
```

Code: [`src/lib/oauth.server.ts`](../src/lib/oauth.server.ts) (worker broker),
[`src/auth/oauth.ts`](../src/auth/oauth.ts) +
[`src/auth/plain.ts`](../src/auth/plain.ts) (client).

The direct path does not use Supabase's `grant_type=id_token` endpoint. It
verifies RS256 signatures, issuer, audience, expiry, email verification, and
nonce inside the worker before using Supabase admin APIs.

## One-time setup

The managed fallback requires no additional credential for this project.
Everything below is optional setup for moving fully to the first-party path
after DEADSET controls its own Supabase project and service-role key.

### 1. Google (≈10 min)

1. Verify domain ownership: [Google Search Console](https://search.google.com/search-console)
   → add property `deadsetfit.org` → **DNS TXT** verification → add the TXT
   record in Cloudflare DNS. Google requires this before `deadsetfit.org` can be
   an authorized domain.
2. [Google Cloud Console](https://console.cloud.google.com/) → create/select a
   project → **APIs & Services → OAuth consent screen**:
   - User type: **External**, publishing status **In production**.
   - **App name: `deadsetfit.org`** — this is the exact text on the consent
     screen ("Sign in to deadsetfit.org"). Support email: yours.
   - App domain `https://deadsetfit.org`, privacy policy
     `https://deadsetfit.org/privacy`, terms `https://deadsetfit.org/terms`.
   - Authorized domain: `deadsetfit.org`.
   - Scopes: only `openid`, `email`, `profile` — all non-sensitive, so no Google
     verification review and no 100-user cap.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Name: `DEADSET web`
   - Authorized JavaScript origins: `https://deadsetfit.org`
   - Authorized redirect URI: `https://deadsetfit.org/api/auth/google/callback`
     (exactly this, no trailing slash)
4. Copy the client ID and client secret into the worker:

   ```bash
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --name deadset
   ```

   ```bash
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --name deadset
   ```

5. Store the valid service-role credential for the same project as
   `SUPABASE_URL`:

   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name deadset
   ```

   A legacy JWT with a different project `ref` is rejected before sign-in
   starts. Do not copy a key from another Supabase project.

### 2. Apple (≈15 min, needs the paid Apple Developer account)

1. [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list)
   → **Identifiers** → the App ID `org.deadsetfit.app` → enable **Sign In with
   Apple** → Save. (Also tick the capability in Xcode for the native target.)
2. **Identifiers → + → Services IDs**:
   - Description: `DEADSET` (shown on the Apple sheet)
   - Identifier: `org.deadsetfit.web`
   - Enable **Sign In with Apple → Configure**:
     - Primary App ID: `org.deadsetfit.app`
     - Domains and Subdomains: `deadsetfit.org`
     - Return URLs: `https://deadsetfit.org/api/auth/apple/callback`
   - Apple asks you to verify the domain: download
     `apple-developer-domain-association.txt`, save it to
     `public/apple-developer-domain-association.txt`, deploy, then press
     **Verify**. `public/_redirects` already serves it at
     `/.well-known/apple-developer-domain-association.txt`, which is where Apple
     looks.
3. Point the worker at the Services ID:

   ```bash
   npx wrangler secret put APPLE_OAUTH_CLIENT_ID --name deadset
   ```

   (value: `org.deadsetfit.web`)

No Apple client-secret JWT is needed: the broker asks for
`response_type=code id_token` with `response_mode=form_post`, so Apple hands
back a verifiable identity token directly. Nothing to rotate every six months.

### 3. Verify

```bash
curl -s https://deadsetfit.org/api/auth/providers
```

Expect `{"google":true,"apple":true}`. Then check the hand-off actually reaches
the provider:

```bash
curl -sI "https://deadsetfit.org/api/auth/google/start?state=test&flow=web&origin=https://deadsetfit.org" | grep -i location
```

Expect a `302` to `accounts.google.com`. Its `redirect_uri` is the DEADSET
callback on the direct path and the managed broker callback on the fallback
path. A redirect back to `/auth/#error=…` means both paths are unavailable.

Full readiness sweep, including both providers live:

```bash
npm run appstore:strict
```

## Worker configuration

| Name                                       | Kind             | Purpose                                                                   |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`                   | secret           | Google web client                                                         |
| `GOOGLE_OAUTH_CLIENT_SECRET`               | secret           | Google code→id_token exchange                                             |
| `APPLE_OAUTH_CLIENT_ID`                    | secret           | Apple Services ID (`org.deadsetfit.web`)                                  |
| `OAUTH_STATE_SECRET`                       | secret, optional | HMAC key for direct-path signed state                                     |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | existing         | Active Supabase project and public client key                             |
| `SUPABASE_SERVICE_ROLE_KEY`                | secret, optional | Direct session minting; must belong to the same project as `SUPABASE_URL` |
| `LOVABLE_OAUTH_PROJECT_ID`                 | secret, optional | Override for the public managed project ID                                |

## Notes

- **Local development** can start authentication through the deployed broker.
  The direct path may return to localhost; the managed fallback returns to the
  canonical production auth page because its callback allowlist rejects local
  addresses.
- **iPhone** uses the same broker inside `SFSafariViewController` (Google blocks
  embedded webviews) and comes home through
  `https://deadsetfit.org/auth/native-callback`, which deep links to
  `org.deadsetfit.app://auth/callback`.
- Removing a first-party provider credential automatically selects the managed
  fallback. Provider availability is checked at the DEADSET start endpoint.

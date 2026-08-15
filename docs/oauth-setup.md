# Google + Apple sign-in

DEADSET owns the public social-login entry point:
`https://deadsetfit.org/api/auth/<provider>/start`. The worker runs one
first-party session path:

1. **Verify** the provider `id_token` in the worker — RS256 against the
   provider's published JWKS, plus issuer, audience, expiry, provider-verified
   email, and the nonce minted at `/start`.
2. **Mint** the session with the service-role key: create or link the Supabase
   user, then generate and immediately redeem an admin magic link server-side
   (it is never emailed).

Supabase's own `grant_type=id_token` is deliberately unused — it only accepts
client ids allowlisted in the Supabase project's provider config, which is
brittle when that project's dashboard is not under our control.

```
/auth/  →  deadsetfit.org/api/auth/google/start
        →  accounts.google.com/…
        →  verified DEADSET Supabase session
        →  /auth/#access_token=…                  (web)
           /auth/native-callback#access_token=…   (iPhone → org.deadsetfit.app://auth/callback)
```

Code: [`src/lib/oauth.server.ts`](../src/lib/oauth.server.ts) (worker broker),
[`src/auth/oauth.ts`](../src/auth/oauth.ts) +
[`src/auth/plain.ts`](../src/auth/plain.ts) (client).

Both paths verify RS256 signatures, issuer, audience, expiry, email
verification, and nonce inside the worker before accepting the identity.

## One-time setup

The credentials below are required, and the service-role key must belong to the
same Supabase project as `SUPABASE_URL`. Check that with:

```bash
curl -s https://deadsetfit.org/api/health/supabase
```

`{"ok":true,"serviceRoleKey":"valid","project":"…"}` means the key is live and
the project it names is the one sign-in will write to.

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
3. Create a Sign in with Apple key for the primary App ID, download its `.p8`
   file, and point the worker at the Services ID and revocation credentials:

   ```bash
   npx wrangler secret put APPLE_OAUTH_CLIENT_ID --name deadset
   npx wrangler secret put APPLE_TEAM_ID --name deadset
   npx wrangler secret put APPLE_KEY_ID --name deadset
   npx wrangler secret put APPLE_PRIVATE_KEY --name deadset
   ```

   The client ID is `org.deadsetfit.web`. The team and key IDs come from the
   Apple Developer account; paste the complete `.p8` contents as the private
   key. The broker generates five-minute client-secret JWTs at request time,
   exchanges Apple's authorization code, and retains the service-only refresh
   token so account deletion can revoke the Apple authorization.

### 3. Verify

```bash
curl -s https://deadsetfit.org/api/auth/providers
```

Expect `{"google":true,"apple":true}`. Then check the hand-off actually reaches
the provider:

```bash
curl -sI "https://deadsetfit.org/api/auth/google/start?state=test&flow=web&origin=https://deadsetfit.org" | grep -i location
```

Expect a `302` to `accounts.google.com` with the DEADSET callback. A redirect
back to `/auth/#error=…` means the first-party configuration is unavailable.

Full readiness sweep, including both providers live:

```bash
npm run appstore:strict
```

## Worker configuration

| Name                                       | Kind             | Purpose                                                                  |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------ |
| `GOOGLE_OAUTH_CLIENT_ID`                   | secret           | Google web client                                                        |
| `GOOGLE_OAUTH_CLIENT_SECRET`               | secret           | Google code→id_token exchange                                            |
| `APPLE_OAUTH_CLIENT_ID`                    | secret           | Apple Services ID (`org.deadsetfit.web`)                                 |
| `APPLE_TEAM_ID`                            | secret           | Apple Developer team ID                                                  |
| `APPLE_KEY_ID`                             | secret           | Sign in with Apple key ID                                                |
| `APPLE_PRIVATE_KEY`                        | secret           | Complete Sign in with Apple `.p8` private key                            |
| `OAUTH_STATE_SECRET`                       | secret, optional | HMAC key for direct-path signed state                                    |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | existing         | Active Supabase project and public client key                            |
| `SUPABASE_SERVICE_ROLE_KEY`                | secret           | Admin session minting; must belong to the same project as `SUPABASE_URL` |

## Notes

- **Local development** can start authentication through the deployed broker
  and return to an allowed localhost callback.
- **iPhone** uses the same broker inside `SFSafariViewController` (Google blocks
  embedded webviews) and comes home through
  `https://deadsetfit.org/auth/native-callback`, which deep links to
  `org.deadsetfit.app://auth/callback`.
- Missing provider credentials disable that provider. The broker never routes
  authentication through another brand or project.

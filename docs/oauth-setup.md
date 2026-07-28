# Google + Apple sign-in

DEADSET owns the public social-login entry point:
`https://deadsetfit.org/api/auth/<provider>/start`. The worker supports two
first-party session paths:

1. **Provider grant** verifies the provider `id_token`, then exchanges it
   directly with DEADSET's Supabase project.
2. **Admin session minting** verifies the same token, creates or links the
   Supabase user with DEADSET's matching service-role key, and redeems an admin
   magic link if the provider grant is unavailable.

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

The credentials below are required for the first-party path.
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

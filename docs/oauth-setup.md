# Google + Apple sign-in on deadsetfit.org

DEADSET brokers social sign-in itself. Nothing in the flow mentions a third
party: the user taps **Continue with Google / Apple**, the provider's own
consent screen says **deadsetfit.org**, and the provider returns to
`https://deadsetfit.org/api/auth/<provider>/callback`.

```
/auth/  →  deadsetfit.org/api/auth/google/start   (worker mints a signed state + nonce)
        →  accounts.google.com/…                  ("Sign in to deadsetfit.org")
        →  deadsetfit.org/api/auth/google/callback (code → id_token → Supabase session)
        →  /auth/#access_token=…                  (web)
           /auth/native-callback#access_token=…   (iPhone → org.deadsetfit.app://auth/callback)
```

Code: [`src/lib/oauth.server.ts`](../src/lib/oauth.server.ts) (worker broker),
[`src/auth/oauth.ts`](../src/auth/oauth.ts) +
[`src/auth/plain.ts`](../src/auth/plain.ts) (client).

The broker converts the provider's `id_token` into a Supabase session with the
`grant_type=id_token` endpoint. Supabase's own `/authorize` redirect is
deliberately unused — it would put `<project-ref>.supabase.co` on the Google
screen.

## One-time setup

Everything below happens in consoles you own. The code is already deployed and
reports `{"google":false}` on `/api/auth/providers` until the credentials exist.

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

5. Supabase → **Authentication → Providers → Google** (already enabled): paste
   the same client ID into **Client IDs** (the id_token/native field, comma
   separated). That list is what Supabase checks when the broker redeems the
   token. Leave "Skip nonce check" **off** — the broker always sends a nonce.

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

4. Supabase → **Authentication → Providers → Apple** (already enabled): set
   **Client IDs** to `org.deadsetfit.web,org.deadsetfit.app` — the Services ID
   for web/iPhone-browser sign-in, the bundle ID for a future native Sign in
   with Apple sheet.

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

Expect a `302` to `accounts.google.com` with
`redirect_uri=https://deadsetfit.org/api/auth/google/callback`. A redirect back
to `/auth/#error=…` means a credential is missing — the worker logs the reason
(`wrangler tail --name deadset`).

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
| `OAUTH_STATE_SECRET`                       | secret, optional | HMAC key for the signed state; falls back to `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | existing         | id_token → session exchange                                              |

## Notes

- **Local development** against the deployed broker works: the client sends
  `origin=http://localhost:5173` and the broker returns the session there.
  Only origins we own (plus localhost) are accepted — the fragment carries
  tokens, so an unchecked origin would be a token-leaking open redirect.
- **iPhone** uses the same broker inside `SFSafariViewController` (Google blocks
  embedded webviews) and comes home through
  `https://deadsetfit.org/auth/native-callback`, which deep links to
  `org.deadsetfit.app://auth/callback`.
- **Deleting a provider** is a one-liner: clear its client ID secret and
  `/api/auth/providers` reports it as unavailable, which makes the button say
  "use email for now" instead of failing mid-redirect.

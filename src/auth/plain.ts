import { createClient, type Session } from "@supabase/supabase-js";
import {
  authModeFromUrl,
  buildOAuthStartUrl,
  createOAuthState,
  emailAuthRedirectUrl,
  hasOAuthResult,
  NATIVE_AUTH_BRIDGE,
  NATIVE_AUTH_CALLBACK,
  oauthProvidersUrl,
  parseOAuthCallback,
  type OAuthProvider,
} from "./oauth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const sessionBackupKey = "deadset_auth_session_v1";
const sessionCookieAccess = "deadset_at";
const sessionCookieRefresh = "deadset_rt";
const supabaseCookiePrefix = "deadset_sb_";
const cookieMaxAge = 60 * 60 * 24 * 180;
const oauthStateKey = "deadset_oauth_state_v1";

const form = document.getElementById("auth-form") as HTMLFormElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const submitButton = document.getElementById("submit") as HTMLButtonElement;
const googleButton = document.getElementById("google-auth") as HTMLButtonElement;
const appleButton = document.getElementById("apple-auth") as HTMLButtonElement;
const socialOptions = document.getElementById("social-options") as HTMLDivElement;
const emailDivider = document.getElementById("email-divider") as HTMLDivElement;
const authTitle = document.getElementById("auth-title") as HTMLHeadingElement;
const authSubtitle = document.getElementById("auth-subtitle") as HTMLParagraphElement;
const modeRow = document.getElementById("mode-row") as HTMLParagraphElement;
const modeQuestion = document.getElementById("mode-question") as HTMLSpanElement;
const modeSwitch = document.getElementById("mode-switch") as HTMLButtonElement;
const forgotButton = document.getElementById("forgot") as HTMLButtonElement;
const message = document.getElementById("message") as HTMLDivElement;
const togglePassword = document.getElementById("toggle-password") as HTMLButtonElement | null;
const passwordHint = document.getElementById("password-hint") as HTMLParagraphElement | null;
const freeNote = document.getElementById("free-note") as HTMLParagraphElement | null;
const closeButton = document.getElementById("close") as HTMLButtonElement;

let mode: "signin" | "signup" = "signup";
// Landing from a Supabase email link (?code=...) — confirm or recovery.
// The auth event (SIGNED_IN vs PASSWORD_RECOVERY) decides what happens.
let recoveryMode = false;
const initialAuthCallback = parseOAuthCallback(window.location.href);
const hasAuthCallback = hasOAuthResult(initialAuthCallback);

function setMessage(text: string, tone: "neutral" | "error" | "success" = "neutral") {
  message.textContent = text;
  message.classList.toggle("error", tone === "error");
  message.classList.toggle("success", tone === "success");
}

function updatePasswordHint() {
  if (!passwordHint) return;
  passwordHint.hidden = mode !== "signup";
  const ok = passwordInput.value.length >= 6;
  passwordHint.classList.toggle("ok", ok);
  passwordHint.textContent = ok ? "✓ At least 6 characters" : "At least 6 characters";
}

function setBusy(busy: boolean) {
  submitButton.disabled = busy;
  googleButton.disabled = busy;
  appleButton.disabled = busy;
  modeSwitch.disabled = busy;
  forgotButton.disabled = busy;
  submitButton.textContent = busy
    ? "Please wait..."
    : recoveryMode
      ? "Set New Password"
      : mode === "signup"
        ? "Create Account"
        : "Log In";
}

function cookieAttributes(maxAge = cookieMaxAge) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}${cookieAttributes()}`;
}

function removeCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function getCookie(name: string) {
  const prefix = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!found) return null;
  try {
    return decodeURIComponent(found.slice(prefix.length));
  } catch {
    return null;
  }
}

function cookieKey(key: string) {
  return `${supabaseCookiePrefix}${btoa(key).replace(/=+$/g, "")}`;
}

function safeLocalStorageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* cookie fallback still persists the session */
  }
}

function safeLocalStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function persistentAuthStorage() {
  return {
    getItem(key: string) {
      return safeLocalStorageGet(key) ?? getCookie(cookieKey(key));
    },
    setItem(key: string, value: string) {
      safeLocalStorageSet(key, value);
      setCookie(cookieKey(key), value);
    },
    removeItem(key: string) {
      safeLocalStorageRemove(key);
      removeCookie(cookieKey(key));
    },
  };
}

function saveSessionBackup(session: Session) {
  safeLocalStorageSet(
    sessionBackupKey,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  );
  setCookie(sessionCookieAccess, session.access_token);
  setCookie(sessionCookieRefresh, session.refresh_token);
}

function isNativeShell() {
  return (
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    (
      window as typeof window & {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor?.isNativePlatform?.() === true
  );
}

function emailRedirectUrl() {
  return emailAuthRedirectUrl(isNativeShell(), window.location.origin);
}

/** The broker sends the finished session to /auth/ on the web and to the
 *  HTTPS bridge (which deep links into the app) on iOS. */
function oauthFlow(): "web" | "native" {
  return isNativeShell() ? "native" : "web";
}

function oauthReturnOrigin() {
  return isNativeShell() ? new URL(NATIVE_AUTH_BRIDGE).origin : window.location.origin;
}

function saveOAuthState(state: string) {
  safeLocalStorageSet(oauthStateKey, state);
}

function validateAndClearOAuthState(callbackState: string | null) {
  if (!callbackState) return true;
  const expected = safeLocalStorageGet(oauthStateKey);
  safeLocalStorageRemove(oauthStateKey);
  return Boolean(expected && expected === callbackState);
}

async function destinationFor(session: Session, signingUp = false) {
  if (signingUp || !session.user.id || !supabase) return "/onboarding";
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) return "/train";
  return data ? "/train" : "/onboarding";
}

function errorMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error && error.message.trim() ? error.message : fallback;
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Wrong email or password. Try again, or tap “Forgot password?”";
  }
  if (lower.includes("already registered")) {
    return "That email already has an account — sign in instead.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link we sent.";
  }
  if (lower.includes("at least 6 characters") || lower.includes("password should be")) {
    return "Password needs at least 6 characters.";
  }
  if (lower.includes("you can only request this after") || lower.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Can’t reach the server. Check your connection and try again.";
  }
  return raw;
}

const supabase =
  supabaseUrl && publishableKey
    ? createClient(supabaseUrl, publishableKey, {
        auth: {
          storage: persistentAuthStorage(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

function enterRecoveryMode(session: Session | null) {
  recoveryMode = true;
  if (session?.user.email) emailInput.value = session.user.email;
  emailInput.disabled = true;
  socialOptions.hidden = true;
  emailDivider.hidden = true;
  modeRow.hidden = true;
  forgotButton.hidden = true;
  if (freeNote) freeNote.hidden = true;
  authTitle.textContent = "Reset your password";
  authSubtitle.textContent = "Choose a new password to secure your account.";
  passwordInput.value = "";
  passwordInput.autocomplete = "new-password";
  submitButton.textContent = "Set New Password";
  setMessage("Choose a new password for your account.");
  passwordInput.focus();
}

supabase?.auth.onAuthStateChange((event, session) => {
  if (session) saveSessionBackup(session);
  if (event === "PASSWORD_RECOVERY") {
    enterRecoveryMode(session);
  }
});

async function restoreExistingSession() {
  // When arriving from an email link, the auth event decides the destination —
  // never auto-redirect a recovery visit before the new password is set.
  if (!supabase || hasAuthCallback) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    saveSessionBackup(session);
    window.location.replace(await destinationFor(session));
  }
}

async function sessionFromCallback(callback: ReturnType<typeof parseOAuthCallback>) {
  if (!supabase) throw new Error("Authentication is not configured.");
  if (!validateAndClearOAuthState(callback.state)) {
    throw new Error("The sign-in response could not be verified. Please try again.");
  }

  if (callback.accessToken && callback.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  if (callback.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
    return data.session;
  }

  throw new Error("Sign in returned without a session. Please try again.");
}

async function completeBrowserAuthCallback() {
  if (!hasAuthCallback || !supabase) return false;
  if (initialAuthCallback.error) {
    setMessage(
      errorMessage(new Error(initialAuthCallback.error), "Sign in was cancelled."),
      "error",
    );
    return true;
  }

  setBusy(true);
  setMessage("Finishing secure sign in...");
  try {
    const session = await sessionFromCallback(initialAuthCallback);
    if (!session) throw new Error("No session returned. Please try again.");
    saveSessionBackup(session);
    window.history.replaceState({}, "", "/auth/index.html");
    if (initialAuthCallback.type === "recovery") {
      enterRecoveryMode(session);
      setBusy(false);
      return true;
    }
    window.location.replace(await destinationFor(session));
  } catch (error) {
    setMessage(errorMessage(error, "Could not finish sign in."), "error");
    setBusy(false);
  }
  return true;
}

async function setupNativeAuthCallback() {
  if (!isNativeShell() || !supabase) return;
  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);

  const handleUrl = async (url: string) => {
    if (!url.startsWith(NATIVE_AUTH_CALLBACK)) return;
    await Browser.close().catch(() => {});
    const callback = parseOAuthCallback(url);
    if (callback.error) {
      setMessage(errorMessage(new Error(callback.error), "Sign in was cancelled."), "error");
      setBusy(false);
      return;
    }

    setBusy(true);
    setMessage("Finishing secure sign in...");
    try {
      const session = await sessionFromCallback(callback);
      if (!session) throw new Error("No session returned. Please try again.");
      saveSessionBackup(session);
      if (callback.type === "recovery") {
        enterRecoveryMode(session);
        setBusy(false);
        return;
      }
      window.location.replace(await destinationFor(session));
    } catch (error) {
      setMessage(errorMessage(error, "Could not finish sign in."), "error");
      setBusy(false);
    }
  };

  await App.addListener("appUrlOpen", ({ url }) => void handleUrl(url));
  await Browser.addListener("browserFinished", () => setBusy(false));
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleUrl(launch.url);
}

function switchMode(next: "signin" | "signup") {
  mode = next;
  const signingUp = mode === "signup";
  authTitle.textContent = signingUp ? "Create your account" : "Welcome back";
  authSubtitle.textContent = signingUp
    ? "Build your training plan and start logging in minutes."
    : "Log in to continue your training.";
  modeQuestion.textContent = signingUp ? "Already have an account?" : "New to DEADSET?";
  modeSwitch.textContent = signingUp ? "Log in" : "Create an account";
  passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
  forgotButton.hidden = signingUp;
  submitButton.textContent = signingUp ? "Create Account" : "Log In";
  if (freeNote) freeNote.hidden = !signingUp;
  updatePasswordHint();
  setMessage("");
}

modeSwitch.addEventListener("click", () => switchMode(mode === "signup" ? "signin" : "signup"));

/** Asks the broker whether the provider's credentials are live, so an
 *  unconfigured provider says so instead of bouncing through a broken redirect. */
async function providerConfigurationError(provider: OAuthProvider, providerName: string) {
  try {
    const response = await fetch(oauthProvidersUrl(import.meta.env.VITE_API_ORIGIN), {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const providers = (await response.json()) as Partial<Record<OAuthProvider, boolean>>;
    if (providers[provider] === false) {
      return `${providerName} sign-in is temporarily unavailable. Use email for now.`;
    }
    return null;
  } catch {
    // A blocked probe must not block sign-in — let the redirect speak instead.
    return null;
  }
}

async function continueWithProvider(provider: OAuthProvider) {
  if (!supabase) {
    setMessage("Authentication is not configured.", "error");
    return;
  }

  setBusy(true);
  setMessage(`Opening ${provider === "google" ? "Google" : "Apple"}…`);
  try {
    const state = createOAuthState();
    saveOAuthState(state);
    const authorizationUrl = buildOAuthStartUrl(provider, {
      state,
      flow: oauthFlow(),
      origin: oauthReturnOrigin(),
      brokerOrigin: import.meta.env.VITE_API_ORIGIN,
    });
    const providerName = provider === "google" ? "Google" : "Apple";
    const configurationError = await providerConfigurationError(provider, providerName);
    if (configurationError) throw new Error(configurationError);
    if (isNativeShell()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: authorizationUrl, presentationStyle: "popover" });
    } else {
      window.location.assign(authorizationUrl);
    }
  } catch (error) {
    setMessage(errorMessage(error, `Could not open ${provider} sign in.`), "error");
    setBusy(false);
  }
}

googleButton.addEventListener("click", () => void continueWithProvider("google"));
appleButton.addEventListener("click", () => void continueWithProvider("apple"));

togglePassword?.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.classList.toggle("showing", !showing);
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  passwordInput.focus();
});

passwordInput.addEventListener("input", updatePasswordHint);

closeButton.addEventListener("click", () => {
  window.location.assign("/");
});

forgotButton.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    setMessage("Enter your email first.", "error");
    emailInput.focus();
    return;
  }
  if (!supabase) {
    setMessage("Authentication is not configured.", "error");
    return;
  }

  setBusy(true);
  setMessage("Sending reset email...");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirectUrl(),
    });
    if (error) throw error;
    setMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    setMessage(errorMessage(error, "Could not send reset email"), "error");
  } finally {
    setBusy(false);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!supabase) {
    setMessage("Authentication is not configured.", "error");
    return;
  }

  if (recoveryMode) {
    if (password.length < 6) {
      setMessage("Password needs at least 6 characters.", "error");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) saveSessionBackup(session);
      setMessage("Password updated — taking you in...", "success");
      window.location.replace(session ? await destinationFor(session) : "/auth/index.html");
    } catch (error) {
      setMessage(errorMessage(error, "Could not update password"), "error");
    } finally {
      setBusy(false);
    }
    return;
  }

  if (!email || !password) return;

  setBusy(true);
  setMessage("");
  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirectUrl() },
      });
      if (error) throw error;
      if (data.session) {
        saveSessionBackup(data.session);
        window.location.replace(await destinationFor(data.session, true));
        return;
      }
      // With email confirmation on, Supabase "succeeds" for an existing email
      // but returns a user with no identities — surface that honestly.
      if ((data.user?.identities?.length ?? 0) === 0) {
        switchMode("signin");
        setMessage("That email already has an account — sign in instead.", "error");
        return;
      }
      switchMode("signin");
      setMessage(
        "Almost there — confirm your email via the link we sent, then sign in.",
        "success",
      );
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error("No session returned. Please try again.");
    saveSessionBackup(data.session);
    window.location.replace(await destinationFor(data.session));
  } catch (error) {
    setMessage(errorMessage(error, "Authentication failed"), "error");
  } finally {
    setBusy(false);
  }
});

switchMode(authModeFromUrl(window.location.href));
void completeBrowserAuthCallback()
  .then((handled) => {
    if (!handled) return restoreExistingSession();
  })
  .catch(() => {
    /* The form stays usable if callback/session restoration fails. */
  });
void setupNativeAuthCallback().catch(() => {
  setMessage("Native sign in could not start. Email sign in is still available.", "error");
});

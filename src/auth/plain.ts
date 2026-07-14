import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const sessionBackupKey = "deadset_auth_session_v1";
const sessionCookieAccess = "deadset_at";
const sessionCookieRefresh = "deadset_rt";
const supabaseCookiePrefix = "deadset_sb_";
const cookieMaxAge = 60 * 60 * 24 * 180;

const form = document.getElementById("auth-form") as HTMLFormElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const submitButton = document.getElementById("submit") as HTMLButtonElement;
const signinTab = document.getElementById("signin-tab") as HTMLButtonElement;
const signupTab = document.getElementById("signup-tab") as HTMLButtonElement;
const forgotButton = document.getElementById("forgot") as HTMLButtonElement;
const message = document.getElementById("message") as HTMLDivElement;
const togglePassword = document.getElementById("toggle-password") as HTMLButtonElement | null;
const passwordHint = document.getElementById("password-hint") as HTMLParagraphElement | null;
const freeNote = document.getElementById("free-note") as HTMLParagraphElement | null;
const closeButton = document.getElementById("close") as HTMLButtonElement;

let mode: "signin" | "signup" = "signin";

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
  signinTab.disabled = busy;
  signupTab.disabled = busy;
  forgotButton.disabled = busy;
  submitButton.textContent = busy
    ? "Please wait..."
    : mode === "signup"
      ? "Create Account"
      : "Sign In";
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

function redirectUrl() {
  if (window.location.protocol === "capacitor:" || window.location.protocol === "ionic:") {
    return "https://deadsetfit.org/auth/";
  }
  return `${window.location.origin}/auth/`;
}

function destinationFor(session: Session, signingUp = false) {
  if (signingUp || !session.user.id) return "/onboarding";
  return "/train";
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
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;

supabase?.auth.onAuthStateChange((event, session) => {
  if (session) saveSessionBackup(session);
  if (event === "PASSWORD_RECOVERY") {
    setMessage("Password recovery opened. Sign in with your new password after resetting it.");
  }
});

async function restoreExistingSession() {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    saveSessionBackup(session);
    window.location.replace(destinationFor(session));
  }
}

function switchMode(next: "signin" | "signup") {
  mode = next;
  const signingUp = mode === "signup";
  signinTab.classList.toggle("active", !signingUp);
  signupTab.classList.toggle("active", signingUp);
  passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
  forgotButton.style.visibility = signingUp ? "hidden" : "visible";
  submitButton.textContent = signingUp ? "Create Account" : "Sign In";
  if (freeNote) freeNote.hidden = !signingUp;
  updatePasswordHint();
  setMessage("");
}

signinTab.addEventListener("click", () => switchMode("signin"));
signupTab.addEventListener("click", () => switchMode("signup"));

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
      redirectTo: redirectUrl(),
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
  if (!email || !password) return;
  if (!supabase) {
    setMessage("Authentication is not configured.", "error");
    return;
  }

  setBusy(true);
  setMessage("");
  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (error) throw error;
      if (data.session) {
        saveSessionBackup(data.session);
        window.location.replace(destinationFor(data.session, true));
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
      setMessage("Almost there — confirm your email via the link we sent, then sign in.", "success");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error("No session returned. Please try again.");
    saveSessionBackup(data.session);
    window.location.replace(destinationFor(data.session));
  } catch (error) {
    setMessage(errorMessage(error, "Authentication failed"), "error");
  } finally {
    setBusy(false);
  }
});

void restoreExistingSession().catch(() => {
  /* The form stays usable if session restore fails. */
});

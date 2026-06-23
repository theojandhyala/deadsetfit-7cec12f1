const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const sessionBackupKey = "deadset_auth_session_v1";

const form = document.getElementById("auth-form") as HTMLFormElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const submitButton = document.getElementById("submit") as HTMLButtonElement;
const signinTab = document.getElementById("signin-tab") as HTMLButtonElement;
const signupTab = document.getElementById("signup-tab") as HTMLButtonElement;
const forgotButton = document.getElementById("forgot") as HTMLButtonElement;
const message = document.getElementById("message") as HTMLDivElement;
const togglePassword = document.getElementById("toggle-password") as HTMLButtonElement;
const closeButton = document.getElementById("close") as HTMLButtonElement;

let mode: "signin" | "signup" = "signin";

function setMessage(text: string, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

function setBusy(busy: boolean) {
  submitButton.disabled = busy;
  signinTab.disabled = busy;
  signupTab.disabled = busy;
  forgotButton.disabled = busy;
  submitButton.textContent = busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In";
}

function saveSession(payload: Record<string, unknown>) {
  if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") return false;
  localStorage.setItem(sessionBackupKey, JSON.stringify({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  }));
  return true;
}

function switchMode(next: "signin" | "signup") {
  mode = next;
  const signingUp = mode === "signup";
  signinTab.classList.toggle("active", !signingUp);
  signupTab.classList.toggle("active", signingUp);
  passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
  forgotButton.style.visibility = signingUp ? "hidden" : "visible";
  submitButton.textContent = signingUp ? "Create Account" : "Sign In";
  setMessage("");
}

signinTab.addEventListener("click", () => switchMode("signin"));
signupTab.addEventListener("click", () => switchMode("signup"));

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  passwordInput.focus();
});

closeButton.addEventListener("click", () => {
  window.location.assign("/");
});

forgotButton.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    setMessage("Enter your email first.", true);
    emailInput.focus();
    return;
  }
  if (!supabaseUrl || !publishableKey) {
    setMessage("Authentication is not configured.", true);
    return;
  }

  setBusy(true);
  setMessage("Sending reset email…");
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirect_to: `${window.location.origin}/auth` }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.msg ?? payload.message ?? payload.error_description ?? "Could not send reset email"));
    setMessage("Password reset email sent.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not send reset email", true);
  } finally {
    setBusy(false);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return;
  if (!supabaseUrl || !publishableKey) {
    setMessage("Authentication is not configured.", true);
    return;
  }

  setBusy(true);
  setMessage("");
  try {
    const endpoint = mode === "signin" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    const response = await fetch(`${supabaseUrl}${endpoint}`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(mode === "signup" ? { email_redirect_to: `${window.location.origin}/auth` } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(payload.msg ?? payload.message ?? payload.error_description ?? "Authentication failed"));

    if (saveSession(payload)) {
      window.location.replace(mode === "signup" ? "/onboarding" : "/train");
      return;
    }

    switchMode("signin");
    setMessage("Check your email to confirm your account, then sign in.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Authentication failed", true);
  } finally {
    setBusy(false);
  }
});

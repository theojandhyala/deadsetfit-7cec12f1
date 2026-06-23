const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const sessionBackupKey = "deadset_auth_session_v1";

if (!supabaseUrl || !publishableKey) throw new Error("Authentication is not configured");

function saveSessionBackup(payload: Record<string, unknown>) {
  if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") return false;
  localStorage.setItem(sessionBackupKey, JSON.stringify({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  }));
  return true;
}

const form = document.querySelector<HTMLFormElement>("#auth-form")!;
const emailInput = document.querySelector<HTMLInputElement>("#email")!;
const passwordInput = document.querySelector<HTMLInputElement>("#password")!;
const submitButton = document.querySelector<HTMLButtonElement>("#submit")!;
const signinTab = document.querySelector<HTMLButtonElement>("#signin-tab")!;
const signupTab = document.querySelector<HTMLButtonElement>("#signup-tab")!;
const message = document.querySelector<HTMLElement>("#message")!;
const togglePassword = document.querySelector<HTMLButtonElement>("#toggle-password")!;
const forgotPassword = document.querySelector<HTMLButtonElement>("#forgot-password")!;
const closeAuth = document.querySelector<HTMLButtonElement>("#close-auth")!;
let mode: "signin" | "signup" = "signin";

function showMessage(text: string, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

function setMode(nextMode: "signin" | "signup") {
  mode = nextMode;
  const signingUp = mode === "signup";
  signinTab.classList.toggle("active", !signingUp);
  signupTab.classList.toggle("active", signingUp);
  signinTab.setAttribute("aria-selected", String(!signingUp));
  signupTab.setAttribute("aria-selected", String(signingUp));
  submitButton.textContent = signingUp ? "Create Account" : "Sign In";
  passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
  forgotPassword.style.visibility = signingUp ? "hidden" : "visible";
  showMessage("");
  emailInput.focus();
}

signinTab.addEventListener("click", () => setMode("signin"));
signupTab.addEventListener("click", () => setMode("signup"));

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  passwordInput.focus();
});

forgotPassword.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    showMessage("Enter your email first, then tap forgot password.", true);
    emailInput.focus();
    return;
  }

  forgotPassword.disabled = true;
  showMessage("Sending reset email…");
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirect_to: `${window.location.origin}/auth` }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(payload.msg ?? payload.message ?? payload.error_description ?? "Could not send reset email"));
    }
    showMessage("Password reset email sent.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not send reset email", true);
  } finally {
    forgotPassword.disabled = false;
  }
});

closeAuth.addEventListener("click", () => {
  window.location.assign("/");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return;

  submitButton.disabled = true;
  submitButton.textContent = "Please wait…";
  showMessage("");

  try {
    const endpoint = mode === "signin" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    const response = await fetch(`${supabaseUrl}${endpoint}`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(mode === "signup" && { email_redirect_to: `${window.location.origin}/auth` }),
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(payload.msg ?? payload.message ?? payload.error_description ?? "Authentication failed"));
    }
    if (saveSessionBackup(payload)) {
      window.location.replace(mode === "signup" ? "/onboarding" : "/train");
      return;
    }
    setMode("signin");
    showMessage("Check your email to confirm your account, then sign in.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Authentication failed", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = mode === "signup" ? "Create Account" : "Sign In";
  }
});

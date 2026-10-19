import {
  normalizeMobileNumber,
  safeNextPath,
  supabase,
} from "./auth-client.js?v=20261019-auth";

const page = document.body.dataset.authPage;
const form = document.querySelector("#authForm");
const status = document.querySelector("#authStatus");
const submitButton = form?.querySelector('button[type="submit"]');

initialize();

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  if (page === "login" && params.get("confirmed") === "1") {
    showStatus("Your email is confirmed. You can now log in.", "success");
  }

  if (page === "update-password") {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      showStatus(
        "Open this page using the password-reset link sent to your email.",
        "error",
      );
      submitButton.disabled = true;
    }
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSubmitting(true);
  showStatus("", "");

  try {
    if (page === "login") await login();
    if (page === "signup") await signup();
    if (page === "forgot-password") await requestPasswordReset();
    if (page === "update-password") await updatePassword();
  } catch (error) {
    showStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    setSubmitting(false);
  }
});

async function login() {
  const email = fieldValue("email");
  const password = fieldValue("password");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  window.location.replace(safeNextPath());
}

async function signup() {
  const email = fieldValue("email");
  const password = fieldValue("password");
  const confirmPassword = fieldValue("confirmPassword");
  const mobileNumber = normalizeMobileNumber(fieldValue("mobileNumber"));

  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new Error("The passwords do not match.");
  }

  const emailRedirectTo = new URL("./login.html?confirmed=1", window.location.href).href;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { mobile_number: mobileNumber },
    },
  });
  if (error) throw error;

  if (data.session) {
    window.location.replace(safeNextPath());
    return;
  }

  form.reset();
  showStatus(
    "Account created. Check your email and open the confirmation link before logging in.",
    "success",
  );
}

async function requestPasswordReset() {
  const email = fieldValue("email");
  const redirectTo = new URL("./update-password.html", window.location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;

  form.reset();
  showStatus(
    "If an account exists for this email, a password-reset link has been sent.",
    "success",
  );
}

async function updatePassword() {
  const password = fieldValue("password");
  const confirmPassword = fieldValue("confirmPassword");

  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new Error("The passwords do not match.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;

  showStatus("Password updated. Redirecting to your profiles…", "success");
  window.setTimeout(() => window.location.replace(new URL("./search.html", window.location.href).href), 800);
}

function fieldValue(id) {
  return String(document.querySelector(`#${id}`)?.value || "").trim();
}

function setSubmitting(isSubmitting) {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  submitButton.dataset.originalText ||= submitButton.textContent;
  submitButton.textContent = isSubmitting
    ? "Please wait…"
    : submitButton.dataset.originalText;
}

function showStatus(message, type) {
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status${type ? ` ${type}` : ""}`;
  status.hidden = !message;
}

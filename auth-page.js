import { normalizeMobileNumber } from "./auth-client.js?v=20261019-auth";
import { recordVisitor } from "./supabase-client.js";

const page = document.body.dataset.authPage;
const form = document.querySelector("#authForm");
const status = document.querySelector("#authStatus");
const submitButton = form?.querySelector('button[type="submit"]');

initialize();

function initialize() {}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSubmitting(true);
  showStatus("", "");

  try {
    if (page === "signup") await signup();
  } catch (error) {
    showStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    setSubmitting(false);
  }
});

async function signup() {
  const firstName = fieldValue("firstName");
  const lastName = fieldValue("lastName");
  const phone = normalizeMobileNumber(fieldValue("mobileNumber"));

  if (!firstName || !lastName) throw new Error("Enter your first and last name.");
  await recordVisitor({ firstName, lastName, phoneNumber: phone });
  form.reset();
  showStatus("Thank you. Opening profiles…", "success");
  window.setTimeout(() => window.location.replace(new URL("./search.html", window.location.href).href), 250);
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

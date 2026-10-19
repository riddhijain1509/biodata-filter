import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { config } from "./config.js";

export const supabase = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  if (!data.session) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
    return null;
  }

  return data.session;
}

export function safeNextPath() {
  const requested = new URLSearchParams(window.location.search).get("next");
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
    return requested;
  }
  return "/";
}

export function normalizeMobileNumber(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  throw new Error(
    "Enter a valid mobile number with country code, or a 10-digit Indian mobile number.",
  );
}

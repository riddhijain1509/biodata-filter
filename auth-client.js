export function normalizeMobileNumber(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  throw new Error("Enter a valid phone number with country code, or a 10-digit Indian phone number.");
}

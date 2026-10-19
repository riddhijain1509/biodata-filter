import { config } from "./config.js";

const columns = [
  "id",
  "profile_id",
  "full_name",
  "gender",
  "date_of_birth",
  "height_text",
  "height_cm",
  "income_text",
  "income_lpa",
  "family_district",
  "posting_district",
  "caste",
  "occupation_category",
  "manglik",
  "pdf_url",
  "approved",
].join(",");

export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabasePublishableKey);
}

export async function fetchProfilesFromSupabase(accessToken = "") {
  if (!isSupabaseConfigured()) return [];

  const url = new URL(`${config.supabaseUrl}/rest/v1/biodata_profiles`);
  url.searchParams.set("select", columns);
  url.searchParams.set("approved", "eq.true");
  url.searchParams.set("order", "profile_id.asc");

  const headers = { apikey: config.supabasePublishableKey };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows.map(mapSupabaseProfile);
}

function mapSupabaseProfile(row) {
  return {
    id: row.id,
    profileId: row.profile_id || row.id,
    name: row.full_name || "Profile",
    gender: row.gender || "",
    dateOfBirth: row.date_of_birth || "",
    heightText: row.height_text || "",
    heightCm: toNullableNumber(row.height_cm),
    incomeText: row.income_text || "",
    incomeLpa: toNullableNumber(row.income_lpa),
    familyDistrict: row.family_district || "",
    postingDistrict: row.posting_district || "",
    caste: row.caste || "",
    occupation: row.occupation_category || "",
    manglik: typeof row.manglik === "boolean" ? row.manglik : null,
    pdfUrl: row.pdf_url || "",
  };
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

import { config } from "./config.js";

const columns = [
  "id",
  "profile_id",
  "full_name",
  "birth_year",
  "age",
  "gotra",
  "surname",
  "district",
  "current_city",
  "state",
  "education_raw",
  "education_level",
  "education_stream",
  "profession_raw",
  "profession_category",
  "height_text",
  "height_cm",
  "pdf_url",
  "approved",
].join(",");

export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export async function fetchProfilesFromSupabase() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const url = new URL(`${config.supabaseUrl}/rest/v1/biodata_profiles`);
  url.searchParams.set("select", columns);
  url.searchParams.set("approved", "eq.true");
  url.searchParams.set("order", "created_at.desc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows.map(mapSupabaseProfile);
}

function mapSupabaseProfile(row) {
  const location = [row.current_city, row.district, row.state].filter(Boolean).join(", ");

  return {
    sno: row.profile_id || row.id,
    name: row.full_name,
    birthYear: row.birth_year,
    age: row.age,
    surname: row.surname || "",
    gotra: row.gotra || "",
    education: row.education_raw || "",
    educationLevel: row.education_level || "",
    educationStream: row.education_stream || "",
    profession: row.profession_raw || row.profession_category || "",
    heightText: row.height_text || "",
    heightCm: row.height_cm || null,
    district: location || row.district || "",
    pdfUrl: row.pdf_url || "",
  };
}

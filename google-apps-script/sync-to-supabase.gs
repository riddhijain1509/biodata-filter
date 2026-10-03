const SUPABASE_URL_PROPERTY = "SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_PROPERTY = "SUPABASE_SERVICE_ROLE_KEY";

function onFormSubmit(e) {
  const row = getSubmittedRow_(e);
  const profile = buildProfile_(row);
  upsertProfile_(profile);
}

function syncLatestResponseToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No response rows found to sync.");
  }

  const row = getRowFromSheet_(sheet, lastRow);
  const profile = buildProfile_(row);
  upsertProfile_(profile);
  Logger.log("Synced latest response row " + lastRow + " for " + profile.full_name);
}

function syncAllResponsesToSupabase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No response rows found to sync.");
  }

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = getRowFromSheet_(sheet, rowNumber);
    const profile = buildProfile_(row);
    upsertProfile_(profile);
    Logger.log("Synced response row " + rowNumber + " for " + profile.full_name);
  }
}

function getSubmittedRow_(event) {
  if (!event || !event.range) {
    throw new Error("onFormSubmit must run from a spreadsheet form-submit trigger. Use syncLatestResponseToSupabase for a manual test.");
  }

  const sheet = event.range.getSheet();
  return getRowFromSheet_(sheet, event.range.getRow());
}

function getRowFromSheet_(sheet, rowNumber) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = {};

  header.forEach((column, index) => {
    row[String(column).trim()] = values[index];
  });

  row.__rowNumber = rowNumber;
  row.__submittedAt = row.Timestamp || row.timestamp || "";
  return row;
}

function buildProfile_(row) {
  const pdf = parseDriveFile_(row.pdf_upload || row["Biodata PDF"] || row["Biodata PDF Drive Link"] || "");
  const dateOfBirth = toIsoDate_(row.date_of_birth || row["Date of Birth"]);
  const birthYear = dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : null;
  const educationRaw = text_(row.education_raw || row["Education Raw"]);
  const professionRaw = text_(row.profession_raw || row["Profession Raw"]);
  const gotra = chooseOther_(row.gotra || row.Gotra, row["Gotra Other Details"]);
  const surname = text_(row.surname || row.Surname);
  const fullName = text_(row.full_name || row["Full Name"]);

  const education = normalizeEducation_(educationRaw, row.education_level, row.education_stream);
  const searchText = [
    fullName,
    surname,
    gotra,
    row.current_city,
    row.district,
    row.state,
    educationRaw,
    education.level,
    education.stream,
    professionRaw,
    row.profession_category,
  ].map(text_).join(" ").toLowerCase();

  return {
    source_row_id: String(row.__rowNumber),
    profile_id: text_(row.profile_id || row["Profile ID"]) || String(row.__rowNumber),
    full_name: fullName,
    gender: text_(row.gender || row.Gender),
    date_of_birth: dateOfBirth,
    birth_year: birthYear,
    age: birthYear ? new Date().getFullYear() - birthYear : null,
    birth_time: text_(row.birth_time || row["Birth Time"]),
    birth_place: text_(row.birth_place || row["Birth Place"]),
    height_text: text_(row.height || row.Height),
    height_cm: parseHeightCm_(row.height || row.Height),
    gotra,
    gotra_normalized: normalize_(gotra),
    surname,
    surname_normalized: normalize_(surname),
    religion: chooseOther_(row.religion || row.Religion, row["Religion Other Details"]),
    caste: chooseOther_(row.caste || row["Caste / Community"], row["Caste / Community Other Details"]),
    manglik: text_(row.manglik || row.Manglik),
    marital_status: text_(row.marital_status || row["Marital Status"]),
    current_city: text_(row.current_city || row["Current City"]),
    district: text_(row.district || row.District),
    state: text_(row.state || row.State),
    education_raw: educationRaw,
    education_level: education.level,
    education_stream: education.stream,
    education_tags: education.tags,
    profession_raw: professionRaw,
    profession_category: text_(row.profession_category || row["Profession Category"]),
    company_business: text_(row.company_business || row["Company / Business"]),
    family_details: text_(row.family_details || row["Family Details"]),
    contact_person: text_(row.contact_person || row["Contact Person"]),
    contact_number: text_(row.contact_number || row["Contact Number"]),
    email: text_(row.email || row.Email),
    address: text_(row.address || row.Address),
    pdf_file_id: pdf.id,
    pdf_url: pdf.url,
    pdf_name: pdf.name,
    consent: String(row.consent || row["Consent to Store and Display Biodata"] || "").toLowerCase().includes("yes"),
    approved: false,
    search_text: searchText,
    submitted_at: row.__submittedAt ? new Date(row.__submittedAt).toISOString() : new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function upsertProfile_(profile) {
  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = props.getProperty(SUPABASE_URL_PROPERTY);
  const serviceRoleKey = props.getProperty(SUPABASE_SERVICE_ROLE_KEY_PROPERTY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase script properties.");
  }

  const response = UrlFetchApp.fetch(supabaseUrl + "/rest/v1/biodata_profiles?on_conflict=source_row_id", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(profile),
    headers: {
      apikey: serviceRoleKey,
      Authorization: "Bearer " + serviceRoleKey,
      Prefer: "resolution=merge-duplicates",
    },
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("Supabase sync failed: " + status + " " + response.getContentText());
  }
}

function normalizeEducation_(raw, explicitLevel, explicitStream) {
  const normalized = normalize_(raw);
  const tags = [];
  let level = text_(explicitLevel);
  let stream = text_(explicitStream);

  const checks = [
    ["btech", "Graduate", "Engineering", ["engineering", "btech"]],
    ["b tech", "Graduate", "Engineering", ["engineering", "btech"]],
    ["mbbs", "Graduate", "Medical", ["medical", "doctor", "mbbs"]],
    ["ms", "Postgraduate", "Medical", ["medical", "surgery", "postgraduate"]],
    ["md", "Postgraduate", "Medical", ["medical", "doctor", "postgraduate"]],
    ["bcom", "Graduate", "Commerce", ["commerce", "bcom"]],
    ["b com", "Graduate", "Commerce", ["commerce", "bcom"]],
    ["mcom", "Postgraduate", "Commerce", ["commerce", "mcom"]],
    ["mba", "Postgraduate", "Management", ["management", "mba"]],
    ["llb", "Graduate", "Law", ["law", "llb"]],
    ["b ed", "Graduate", "Education", ["education", "bed"]],
    ["bed", "Graduate", "Education", ["education", "bed"]],
    ["interior", "Graduate", "Design", ["design", "interior"]],
  ];

  checks.forEach(([needle, foundLevel, foundStream, foundTags]) => {
    if (normalized.includes(needle)) {
      level = level || foundLevel;
      stream = stream || foundStream;
      tags.push.apply(tags, foundTags);
    }
  });

  return {
    level: level || "",
    stream: stream || "",
    tags: Array.from(new Set(tags)),
  };
}

function parseDriveFile_(value) {
  const text = text_(value);
  const idMatch = text.match(/[-\w]{25,}/);
  return {
    id: idMatch ? idMatch[0] : "",
    url: text,
    name: "",
  };
}

function toIsoDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Etc/UTC", "yyyy-MM-dd");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Utilities.formatDate(date, "Etc/UTC", "yyyy-MM-dd");
}

function normalize_(value) {
  return text_(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function text_(value) {
  return String(value || "").trim();
}

function chooseOther_(selected, otherText) {
  const selectedText = text_(selected);
  const other = text_(otherText);
  if (other && ["other", "not listed", "prefer not to say"].includes(selectedText.toLowerCase())) {
    return other;
  }
  return selectedText || other;
}

function parseHeightCm_(value) {
  const raw = text_(value).toLowerCase();
  if (!raw || raw === "not listed") return null;

  const cmMatch = raw.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (cmMatch) return Number(cmMatch[1]);

  const feetInchMatch = raw.match(/(\d+)\s*(?:'|ft|feet)\s*(\d+)?/);
  if (feetInchMatch) {
    const feet = Number(feetInchMatch[1]);
    const inches = Number(feetInchMatch[2] || 0);
    return Math.round((feet * 12 + inches) * 2.54);
  }

  return null;
}

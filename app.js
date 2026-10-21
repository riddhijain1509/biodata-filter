import {
  fetchProfilesFromSupabase,
  isSupabaseConfigured,
} from "./supabase-client.js";

let activeProfiles = [];

const controls = {
  keyword: document.querySelector("#keyword"),
  minAge: document.querySelector("#minAge"),
  maxAge: document.querySelector("#maxAge"),
  minHeight: document.querySelector("#minHeight"),
  maxHeight: document.querySelector("#maxHeight"),
  occupation: document.querySelector("#occupation"),
  education: document.querySelector("#education"),
  incomeBand: document.querySelector("#incomeBand"),
  caste: document.querySelector("#caste"),
  manglik: document.querySelector("#manglik"),
  familyDistrict: document.querySelector("#familyDistrict"),
  postingDistrict: document.querySelector("#postingDistrict"),
};

const districtSuggestions = {
  family: document.querySelector("#familyDistrictOptions"),
  posting: document.querySelector("#postingDistrictOptions"),
};

const resultCount = document.querySelector("#resultCount");
const resultsList = document.querySelector("#resultsList");
const emptyState = document.querySelector("#emptyState");
const resetBtn = document.querySelector("#resetBtn");
const dataStatus = document.querySelector("#dataStatus");
const userEmail = document.querySelector("#userEmail");
const logoutBtn = document.querySelector("#logoutBtn");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!birthdayHasPassed) age -= 1;
  return age;
}

function formatDate(dateOfBirth) {
  if (!dateOfBirth) return "Not listed";
  const parts = dateOfBirth.split("-");
  if (parts.length !== 3) return dateOfBirth;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getFilters() {
  return {
    keyword: normalize(controls.keyword.value),
    minAge: toNullableNumber(controls.minAge.value),
    maxAge: toNullableNumber(controls.maxAge.value),
    minHeight: toNullableNumber(controls.minHeight.value),
    maxHeight: toNullableNumber(controls.maxHeight.value),
    occupation: controls.occupation.value,
    education: controls.education.value,
    incomeBand: controls.incomeBand.value,
    caste: controls.caste.value,
    manglik: controls.manglik.value,
    familyDistrict: controls.familyDistrict.value,
    postingDistrict: controls.postingDistrict.value,
  };
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function matchesProfile(profile, filters) {
  const age = calculateAge(profile.dateOfBirth);
  const searchable = normalize(
    [
      profile.profileId,
      profile.name,
      profile.caste,
      profile.occupation,
      profile.education,
      profile.familyDistrict,
      profile.postingDistrict,
    ].join(" "),
  );

  if (filters.keyword && !searchable.includes(filters.keyword)) return false;
  if (filters.minAge !== null && (age === null || age < filters.minAge)) {
    return false;
  }
  if (filters.maxAge !== null && (age === null || age > filters.maxAge)) {
    return false;
  }
  if (
    filters.minHeight !== null &&
    (profile.heightCm === null || profile.heightCm < filters.minHeight)
  ) {
    return false;
  }
  if (
    filters.maxHeight !== null &&
    (profile.heightCm === null || profile.heightCm > filters.maxHeight)
  ) {
    return false;
  }
  if (
    filters.occupation &&
    normalize(profile.occupation) !== normalize(filters.occupation)
  ) {
    return false;
  }
  if (
    filters.education &&
    normalize(profile.education) !== normalize(filters.education)
  ) {
    return false;
  }
  if (!matchesIncomeBand(profile.incomeLpa, filters.incomeBand)) return false;
  if (filters.caste && normalize(profile.caste) !== normalize(filters.caste)) {
    return false;
  }
  if (filters.manglik === "yes" && profile.manglik !== true) return false;
  if (filters.manglik === "no" && profile.manglik !== false) return false;
  if (!matchesDistrictQuery(profile.familyDistrict, filters.familyDistrict)) {
    return false;
  }
  if (!matchesDistrictQuery(profile.postingDistrict, filters.postingDistrict)) {
    return false;
  }

  return true;
}

function matchesDistrictQuery(value, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  return normalize(value).includes(normalizedQuery);
}

function matchesIncomeBand(incomeLpa, band) {
  if (!band) return true;
  if (incomeLpa === null || incomeLpa === undefined) return false;
  if (band === "under15") return incomeLpa < 15;
  if (band === "15to25") return incomeLpa >= 15 && incomeLpa <= 25;
  if (band === "over25") return incomeLpa > 25;
  return true;
}

function renderProfile(profile) {
  const age = calculateAge(profile.dateOfBirth);
  const previewUrl = toDrivePreviewUrl(profile.pdfUrl);
  const pdfAction = previewUrl
    ? `<a class="pdf-link" href="${escapeHtml(previewUrl)}" target="_blank" rel="noreferrer">View biodata PDF</a>`
    : `<span class="missing-pdf">PDF link pending</span>`;

  return `
    <article class="profile-card">
      <div class="profile-topline">
        <div class="profile-identity">
          <div class="avatar" aria-hidden="true">${escapeHtml(getInitials(profile.name))}</div>
          <div>
            <p class="profile-id">Profile ${escapeHtml(profile.profileId)}</p>
            <h3>${escapeHtml(profile.name)}</h3>
          </div>
        </div>
        <span class="location-chip">${escapeHtml(profile.postingDistrict || "Posting district not listed")}</span>
      </div>

      <div class="profile-detail-grid">
        ${renderDetail("Age", age === null ? "Not listed" : `${age} years`)}
        ${renderDetail("Height", profile.heightText || (profile.heightCm ? `${profile.heightCm} cm` : "Not listed"))}
        ${renderDetail("Income", profile.incomeText || (profile.incomeLpa !== null ? `${profile.incomeLpa} LPA` : "Not listed"))}
        ${renderDetail("Occupation", profile.occupation || "Not listed")}
        ${renderDetail("Education", profile.education || "Not listed")}
        ${renderDetail("Caste", profile.caste || "Not listed")}
        ${renderDetail("Manglik", profile.manglik === null ? "Not listed" : profile.manglik ? "Yes" : "No")}
        ${renderDetail("Family district", profile.familyDistrict || "Not listed")}
        ${renderDetail("Posting district", profile.postingDistrict || "Not listed")}
      </div>

      <div class="card-footer">
        <span class="match-note">DOB ${escapeHtml(formatDate(profile.dateOfBirth))}</span>
        <div class="actions">${pdfAction}</div>
      </div>
    </article>
  `;
}

function toDrivePreviewUrl(value) {
  const url = String(value || "").trim();
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");
    if (id && parsed.hostname.includes("drive.google.com")) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch {}
  return url;
}

function renderDetail(label, value) {
  return `
    <div class="profile-detail">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function render() {
  const filters = getFilters();
  const filtered = activeProfiles
    .filter((profile) => matchesProfile(profile, filters))
    .sort((a, b) =>
      String(a.profileId || "").localeCompare(String(b.profileId || ""), undefined, {
        numeric: true,
      }),
    );

  resultCount.textContent = filtered.length;
  resultsList.innerHTML = filtered.map(renderProfile).join("");
  emptyState.hidden = filtered.length > 0;
}

function populateDynamicFilters() {
  populateSelect(controls.education, activeProfiles.map((profile) => profile.education));
  populateSelect(controls.caste, activeProfiles.map((profile) => profile.caste));
  populateDatalist(
    districtSuggestions.family,
    activeProfiles.map((profile) => profile.familyDistrict),
  );
  populateDatalist(
    districtSuggestions.posting,
    activeProfiles.map((profile) => profile.postingDistrict),
  );
}

function populateDatalist(datalist, values) {
  if (!datalist) return;
  const unique = new Map();

  values.forEach((value) => {
    const cleanValue = String(value || "").trim();
    const key = normalize(cleanValue);
    if (key && !unique.has(key)) unique.set(key, cleanValue);
  });

  datalist.innerHTML = Array.from(unique.values())
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function populateSelect(select, values) {
  const selected = select.value;
  const label = select.options[0].textContent;
  const unique = new Map();

  values.forEach((value) => {
    const cleanValue = String(value || "").trim();
    const key = normalize(cleanValue);
    if (key && !unique.has(key)) unique.set(key, cleanValue);
  });

  const options = Array.from(unique.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  select.innerHTML = `<option value="">${escapeHtml(label)}</option>`;
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (options.includes(selected)) select.value = selected;
}

async function loadProfiles() {
  if (!isSupabaseConfigured()) {
    dataStatus.textContent = "Supabase is not configured.";
    render();
    return;
  }

  try {
    userEmail.textContent = "Guest access";
    activeProfiles = await fetchProfilesFromSupabase();
    dataStatus.textContent = activeProfiles.length
      ? "Showing approved profiles from Supabase."
      : "No approved profiles are currently available.";
  } catch (error) {
    console.warn(error);
    activeProfiles = [];
    dataStatus.textContent =
      "The profiles could not be loaded. Refresh the page or log in again.";
  }

  populateDynamicFilters();
  render();
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
});

resetBtn.addEventListener("click", () => {
  Object.values(controls).forEach((control) => {
    control.value = "";
  });
  render();
});

logoutBtn?.remove();

loadProfiles();

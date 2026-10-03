import { profiles } from "./profiles.js";
import { fetchProfilesFromSupabase, isSupabaseConfigured } from "./supabase-client.js";

const currentYear = new Date().getFullYear();
let activeProfiles = profiles;

const controls = {
  keyword: document.querySelector("#keyword"),
  minAge: document.querySelector("#minAge"),
  maxAge: document.querySelector("#maxAge"),
  minHeight: document.querySelector("#minHeight"),
  maxHeight: document.querySelector("#maxHeight"),
  gotraMode: document.querySelector("#gotraMode"),
  gotra: document.querySelector("#gotra"),
  education: document.querySelector("#education"),
  profession: document.querySelector("#profession"),
  district: document.querySelector("#district"),
};

const resultCount = document.querySelector("#resultCount");
const resultsList = document.querySelector("#resultsList");
const emptyState = document.querySelector("#emptyState");
const resetBtn = document.querySelector("#resetBtn");
const dataStatus = document.querySelector("#dataStatus");

const aliases = new Map([
  ["btech", "engineering"],
  ["b tech", "engineering"],
  ["bachelor of technology", "engineering"],
  ["engineer", "engineering"],
  ["mbbs", "medical"],
  ["md", "medical"],
  ["ms surgery", "medical"],
  ["general surgery", "medical"],
  ["doctor", "medical"],
  ["bcom", "commerce"],
  ["b com", "commerce"],
  ["mcom", "commerce"],
  ["ba", "arts"],
  ["ma", "postgraduate"],
  ["mba", "management"],
  ["llb", "law"],
  ["advocate", "law"],
  ["lawyer", "law"],
  ["bed", "education"],
  ["b ed", "education"],
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePreference(value) {
  const normalized = normalize(value);
  return aliases.get(normalized) || normalized;
}

function levenshtein(a, b) {
  if (!a || !b) return Math.max(a.length, b.length);
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyIncludes(source, query) {
  const cleanSource = normalize(source);
  const cleanQuery = normalizePreference(query);
  if (!cleanQuery) return true;
  if (cleanSource.includes(cleanQuery)) return true;

  const sourceWords = cleanSource.split(" ").filter(Boolean);
  const queryWords = cleanQuery.split(" ").filter(Boolean);
  return queryWords.every((queryWord) =>
    sourceWords.some((sourceWord) => {
      if (sourceWord.includes(queryWord) || queryWord.includes(sourceWord)) return true;
      const maxDistance = queryWord.length <= 5 ? 1 : 2;
      return levenshtein(sourceWord, queryWord) <= maxDistance;
    }),
  );
}

function profileSearchText(profile) {
  return [
    profile.name,
    profile.surname,
    profile.gotra,
    profile.education,
    profile.educationLevel,
    profile.educationStream,
    profile.profession,
    profile.district,
  ].join(" ");
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
    keyword: controls.keyword.value,
    minAge: Number(controls.minAge.value) || null,
    maxAge: Number(controls.maxAge.value) || null,
    minHeight: Number(controls.minHeight.value) || null,
    maxHeight: Number(controls.maxHeight.value) || null,
    gotraMode: controls.gotraMode.value,
    gotra: controls.gotra.value,
    education: controls.education.value,
    profession: controls.profession.value,
    district: controls.district.value,
  };
}

function scoreProfile(profile, filters) {
  const age = profile.age || (profile.birthYear ? currentYear - profile.birthYear : null);
  let score = 0;
  const reasons = [];

  if (filters.minAge && (!age || age < filters.minAge)) return null;
  if (filters.maxAge && (!age || age > filters.maxAge)) return null;
  if (filters.minHeight && (!profile.heightCm || profile.heightCm < filters.minHeight)) return null;
  if (filters.maxHeight && (!profile.heightCm || profile.heightCm > filters.maxHeight)) return null;

  if (filters.gotra) {
    const gotraMatches = fuzzyIncludes(profile.gotra, filters.gotra);
    if (filters.gotraMode === "include" && !gotraMatches) return null;
    if (filters.gotraMode === "exclude" && gotraMatches) return null;
    if (gotraMatches && filters.gotraMode !== "exclude") {
      score += 25;
      reasons.push("gotra");
    }
  }

  if (filters.keyword) {
    if (!fuzzyIncludes(profileSearchText(profile), filters.keyword)) return null;
    score += 10;
    reasons.push("keyword");
  }

  if (filters.education) {
    const educationText = `${profile.education} ${profile.educationLevel} ${profile.educationStream}`;
    if (!fuzzyIncludes(educationText, filters.education)) return null;
    score += 30;
    reasons.push("education");
  }

  if (filters.profession) {
    if (!fuzzyIncludes(profile.profession, filters.profession)) return null;
    score += 20;
    reasons.push("profession");
  }

  if (filters.district) {
    if (!fuzzyIncludes(profile.district, filters.district)) return null;
    score += 10;
    reasons.push("city");
  }

  if (filters.minAge || filters.maxAge) {
    score += 15;
    reasons.push("age");
  }

  if (filters.minHeight || filters.maxHeight) {
    score += 10;
    reasons.push("height");
  }

  return { ...profile, age, score, reasons };
}

function renderProfile(profile) {
  const pdfAction = profile.pdfUrl
    ? `<a class="pdf-link" href="${escapeHtml(profile.pdfUrl)}" target="_blank" rel="noreferrer">Open biodata PDF</a>`
    : `<span class="missing-pdf">PDF link pending</span>`;
  const location = profile.district || "Location not listed";
  const matchedText = profile.reasons.length ? profile.reasons.join(", ") : "available profile data";

  return `
    <article class="profile-card">
      <div class="profile-topline">
        <div class="avatar" aria-hidden="true">${escapeHtml(getInitials(profile.name))}</div>
        <div>
          <p class="profile-id">Profile ${escapeHtml(profile.sno)}</p>
          <h3>${escapeHtml(profile.name)}</h3>
        </div>
        <span class="location-chip">${escapeHtml(location)}</span>
      </div>
      <p class="profile-subtitle">${escapeHtml(profile.education || "Education not listed")}</p>
      <p class="profile-work">${escapeHtml(profile.profession || "Profession not listed")}</p>
        <div class="meta">
        <span class="pill">Age ${escapeHtml(profile.age || "Not listed")}</span>
        <span class="pill">Height ${escapeHtml(profile.heightText || (profile.heightCm ? profile.heightCm + " cm" : "Not listed"))}</span>
        <span class="pill">Gotra ${escapeHtml(profile.gotra || "Not listed")}</span>
        <span class="pill">${escapeHtml(profile.educationStream || "Stream not listed")}</span>
        </div>
      <div class="card-footer">
        <span class="match-note">Matched on ${escapeHtml(matchedText)}</span>
        <div class="actions">${pdfAction}</div>
      </div>
    </article>
  `;
}

function render() {
  const filters = getFilters();
  const ranked = activeProfiles
    .map((profile) => scoreProfile(profile, filters))
    .filter(Boolean)
    .sort((a, b) => {
      const ageA = Number.isFinite(a.age) ? a.age : 999;
      const ageB = Number.isFinite(b.age) ? b.age : 999;
      return b.score - a.score || ageA - ageB || String(a.name || "").localeCompare(String(b.name || ""));
    });

  resultCount.textContent = ranked.length;
  resultsList.innerHTML = ranked.map(renderProfile).join("");
  emptyState.hidden = ranked.length > 0;
}

async function loadProfiles() {
  if (!isSupabaseConfigured()) {
    dataStatus.textContent = "Showing sample local profiles until Supabase is configured.";
    render();
    return;
  }

  try {
    const supabaseProfiles = await fetchProfilesFromSupabase();
    activeProfiles = supabaseProfiles;
    dataStatus.textContent = supabaseProfiles.length
      ? "Showing approved profiles from Supabase. Results are sorted by strongest match."
      : "Connected to Supabase. No approved profiles are visible yet.";
  } catch (error) {
    console.warn(error);
    activeProfiles = [];
    dataStatus.textContent = "Supabase is configured, but the site cannot read profiles yet. Check table permissions and approved rows.";
  }

  render();
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
});

resetBtn.addEventListener("click", () => {
  Object.values(controls).forEach((control) => {
    control.value = control.id === "gotraMode" ? "any" : "";
  });
  render();
});

loadProfiles();

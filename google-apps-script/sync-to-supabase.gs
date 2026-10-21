const SUPABASE_SYNC_URL_PROPERTY = "SUPABASE_URL";
const SUPABASE_SYNC_SECRET_KEY_PROPERTY = "SUPABASE_SECRET_KEY";
const SUPABASE_SYNC_SHEET_NAME = "Sheet1";

const SUPABASE_SYNC_OCCUPATIONS = [
  "Engineering",
  "Healthcare",
  "Finance",
  "Business",
  "Management",
  "Government",
  "Teaching",
  "Legal",
  "Marketing",
  "Not Working",
  "Other",
];

/**
 * Backfills the current Sheet and then reconciles it with Supabase.
 * Existing rows are updated by Profile ID. Database rows controlled by this
 * Sheet are deleted when their Profile ID no longer exists in the Sheet.
 */
function syncAllProfilesToSupabase() {
  syncSheetToSupabase();
}

function syncSheetToSupabase() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log(
      "Supabase synchronization skipped because another synchronization is running."
    );
    return;
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SUPABASE_SYNC_SHEET_NAME);
    if (!sheet) {
      throw new Error("Missing sheet: " + SUPABASE_SYNC_SHEET_NAME);
    }

    const connection = getSupabaseConnection_();
    const sheetData = readProfilesFromSheet_(spreadsheet, sheet);

    if (sheetData.profiles.length) {
      upsertSupabaseProfiles_(connection, sheetData.profiles);
    }

    deleteMissingSupabaseProfiles_(
      connection,
      spreadsheet.getId(),
      sheetData.profileIds
    );

    Logger.log(
      "Supabase synchronization complete. Profiles in Sheet: " +
        sheetData.profileIds.length +
        "; profiles upserted: " +
        sheetData.profiles.length
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Install once. Manual edits sync immediately; the five-minute reconciliation
 * catches row deletions and changes made by another Apps Script.
 */
function installSupabaseSyncTriggers() {
  const handlers = ["onProfileSheetEdit", "scheduledProfileSync"];

  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return handlers.indexOf(trigger.getHandlerFunction()) !== -1;
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("onProfileSheetEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  ScriptApp.newTrigger("scheduledProfileSync")
    .timeBased()
    .everyMinutes(5)
    .create();
}

function onProfileSheetEdit(event) {
  if (!event || !event.range) return;
  if (event.range.getSheet().getName() !== SUPABASE_SYNC_SHEET_NAME) return;
  if (event.range.getRow() === 1) return;
  syncSheetToSupabase();
}

function scheduledProfileSync() {
  syncSheetToSupabase();
}

function readProfilesFromSheet_(spreadsheet, sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error("The profile Sheet has no columns.");
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(syncText_);

  const columns = {
    profileId: findSyncColumn_(headers, ["Profile ID"]),
    name: findSyncColumn_(headers, ["Name"]),
    pdf: findSyncColumn_(headers, ["Profile PDF Link"]),
    caste: findSyncColumn_(headers, ["Caste"]),
    education: findSyncColumn_(headers, ["Education"]),
    dob: findSyncColumn_(headers, ["DOB", "Date of Birth"]),
    height: findSyncColumn_(headers, ["Height", "Hight (0.00)"]),
    occupation: findSyncColumn_(headers, ["Occupation"]),
    income: findSyncColumn_(headers, ["Income"]),
    manglik: findSyncColumn_(headers, ["Manglik"]),
    familyDistrict: findSyncColumn_(headers, ["Family District"]),
    postingDistrict: findSyncColumn_(headers, [
      "Posting District",
      "Current District",
    ]),
  };

  Object.keys(columns).forEach(function(key) {
    if (columns[key] === -1) {
      throw new Error("Missing required Sheet column for: " + key);
    }
  });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { profiles: [], profileIds: [] };
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, lastColumn).getValues();
  const pdfRange = sheet.getRange(2, columns.pdf + 1, rowCount, 1);
  const pdfFormulas = pdfRange.getFormulas();
  const pdfRichText = pdfRange.getRichTextValues();
  const profiles = [];
  const profileIds = [];
  const seen = {};
  const errors = [];
  const sourceSheetId = spreadsheet.getId();
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone();

  values.forEach(function(row, offset) {
    const rowNumber = offset + 2;
    const profileId = normalizeSyncProfileId_(row[columns.profileId]);
    if (!profileId) return;

    profileIds.push(profileId);
    if (seen[profileId]) {
      errors.push(
        "Rows " +
          seen[profileId] +
          " and " +
          rowNumber +
          " have the same Profile ID " +
          profileId +
          "."
      );
      return;
    }
    seen[profileId] = rowNumber;

    const fullName = syncText_(row[columns.name])
      .replace(/\.pdf$/i, "")
      .trim();
    if (!fullName) {
      errors.push("Row " + rowNumber + " has a Profile ID but no Name.");
      return;
    }

    const pdf = extractSyncPdf_(
      row[columns.pdf],
      pdfFormulas[offset][0],
      pdfRichText[offset][0],
      profileId,
      fullName
    );
    const height = parseSyncHeight_(row[columns.height]);
    const income = parseSyncIncome_(row[columns.income]);

    profiles.push({
      profile_id: profileId,
      full_name: fullName,
      gender: profileId.charAt(0) === "G" ? "Girl" : "Boy",
      pdf_file_id: pdf.id,
      pdf_url: pdf.url,
      pdf_name: pdf.name,
      date_of_birth: toSyncIsoDate_(row[columns.dob], timezone),
      height_text: height.text,
      height_cm: height.cm,
      income_text: income.text,
      income_lpa: income.lpa,
      family_district: nullableSyncText_(row[columns.familyDistrict]),
      posting_district: nullableSyncText_(row[columns.postingDistrict]),
      caste: nullableSyncText_(row[columns.caste]),
      occupation_category: normalizeSyncOccupation_(row[columns.occupation]),
      education: nullableSyncText_(row[columns.education]),
      manglik: parseSyncManglik_(row[columns.manglik]),
      source_sheet_id: sourceSheetId,
      synced_at: new Date().toISOString(),
    });
  });

  if (errors.length) {
    throw new Error("Fix these Sheet problems before syncing:\n" + errors.join("\n"));
  }

  return { profiles: profiles, profileIds: profileIds };
}

function upsertSupabaseProfiles_(connection, profiles) {
  const response = UrlFetchApp.fetch(
    connection.url + "/rest/v1/biodata_profiles?on_conflict=profile_id",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(profiles),
      headers: {
        apikey: connection.secretKey,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      muteHttpExceptions: true,
    }
  );

  assertSyncResponse_(response, "Supabase upsert");
}

function deleteMissingSupabaseProfiles_(connection, sourceSheetId, sheetIds) {
  const query =
    "/rest/v1/biodata_profiles?select=profile_id&source_sheet_id=eq." +
    encodeURIComponent(sourceSheetId);
  const response = UrlFetchApp.fetch(connection.url + query, {
    method: "get",
    headers: { apikey: connection.secretKey },
    muteHttpExceptions: true,
  });

  assertSyncResponse_(response, "Supabase reconciliation read");
  const existing = JSON.parse(response.getContentText() || "[]");
  const keep = {};
  sheetIds.forEach(function(profileId) {
    keep[profileId] = true;
  });

  const deleteRequests = existing
    .filter(function(record) {
      return !keep[record.profile_id];
    })
    .map(function(record) {
      return {
        url:
          connection.url +
          "/rest/v1/biodata_profiles?source_sheet_id=eq." +
          encodeURIComponent(sourceSheetId) +
          "&profile_id=eq." +
          encodeURIComponent(record.profile_id),
        method: "delete",
        headers: {
          apikey: connection.secretKey,
          Prefer: "return=minimal",
        },
        muteHttpExceptions: true,
      };
    });

  if (!deleteRequests.length) return;

  UrlFetchApp.fetchAll(deleteRequests).forEach(function(deleteResponse) {
    assertSyncResponse_(deleteResponse, "Supabase deletion");
  });
}

function getSupabaseConnection_() {
  const properties = PropertiesService.getScriptProperties();
  const url = syncText_(
    properties.getProperty(SUPABASE_SYNC_URL_PROPERTY)
  ).replace(/\/$/, "");
  const secretKey = syncText_(
    properties.getProperty(SUPABASE_SYNC_SECRET_KEY_PROPERTY)
  );

  if (!url || !secretKey) {
    throw new Error(
      "Add SUPABASE_URL and SUPABASE_SECRET_KEY in Apps Script > Project Settings > Script Properties."
    );
  }

  if (secretKey.indexOf("sb_secret_") !== 0) {
    throw new Error("SUPABASE_SECRET_KEY must begin with sb_secret_.");
  }

  return { url: url, secretKey: secretKey };
}

function findSyncColumn_(headers, acceptedNames) {
  const normalizedHeaders = headers.map(function(header) {
    return header.toLowerCase();
  });

  for (let index = 0; index < acceptedNames.length; index++) {
    const found = normalizedHeaders.indexOf(acceptedNames[index].toLowerCase());
    if (found !== -1) return found;
  }
  return -1;
}

function normalizeSyncProfileId_(value) {
  const match = syncText_(value).match(/^([GB])\s*0*(\d+)$/i);
  return match
    ? match[1].toUpperCase() + String(Number(match[2]))
    : "";
}

function extractSyncPdf_(rawValue, formula, richText, profileId, fullName) {
  let url = "";
  const formulaMatch = syncText_(formula).match(
    /^=HYPERLINK\(\s*"([^"]+)"/i
  );
  if (formulaMatch) url = formulaMatch[1];

  if (!url && richText) {
    url = richText.getLinkUrl() || "";
    if (!url) {
      const runs = richText.getRuns();
      for (let index = 0; index < runs.length; index++) {
        const runUrl = runs[index].getLinkUrl();
        if (runUrl) {
          url = runUrl;
          break;
        }
      }
    }
  }

  if (!url && /^https?:\/\//i.test(syncText_(rawValue))) {
    url = syncText_(rawValue);
  }

  const idMatch =
    url.match(/\/d\/([-\w]{20,})/) || url.match(/[?&]id=([-\w]{20,})/);

  return {
    id: idMatch ? idMatch[1] : null,
    url: url || null,
    name: url ? profileId + "-" + fullName + ".pdf" : null,
  };
}

function parseSyncHeight_(value) {
  const text = syncText_(value);
  if (!text) return { text: null, cm: null };

  if (typeof value === "number") {
    if (value >= 100 && value <= 250) {
      return { text: text, cm: Math.round(value * 100) / 100 };
    }

    if (value >= 4 && value < 8) {
      const feet = Math.floor(value);
      const inches = Math.round((value - feet) * 100);
      if (inches >= 0 && inches <= 11) {
        return {
          text: text,
          cm: Math.round((feet * 12 + inches) * 2.54 * 100) / 100,
        };
      }
    }
  }

  const normalized = text.toLowerCase();
  const cmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (cmMatch) return { text: text, cm: Number(cmMatch[1]) };

  const feetMatch = normalized.match(/(\d+)\s*(?:'|ft|feet)\s*(\d+)?/);
  if (feetMatch) {
    const feet = Number(feetMatch[1]);
    const inches = Number(feetMatch[2] || 0);
    return {
      text: text,
      cm: Math.round((feet * 12 + inches) * 2.54 * 100) / 100,
    };
  }

  const decimalMatch = normalized.match(/^(\d)\.(\d{1,2})$/);
  if (decimalMatch) {
    const feet = Number(decimalMatch[1]);
    const inches = Number(decimalMatch[2].padStart(2, "0"));
    if (inches <= 11) {
      return {
        text: text,
        cm: Math.round((feet * 12 + inches) * 2.54 * 100) / 100,
      };
    }
  }

  return { text: text, cm: null };
}

function parseSyncIncome_(value) {
  const text = syncText_(value);
  if (!text) return { text: null, lpa: null };

  let number;
  if (typeof value === "number") {
    number = value;
  } else {
    const numericText = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    number = numericText ? Number(numericText[0]) : NaN;
  }

  if (!Number.isFinite(number)) return { text: text, lpa: null };
  if (number >= 10000) number = number / 100000;
  return { text: text, lpa: Math.round(number * 100) / 100 };
}

function normalizeSyncOccupation_(value) {
  const text = syncText_(value);
  if (!text) return null;

  const exact = SUPABASE_SYNC_OCCUPATIONS.find(function(category) {
    return category.toLowerCase() === text.toLowerCase();
  });
  if (exact) return exact;

  const normalized = text.toLowerCase();
  const mappings = [
    [/engineer|software|developer|technology|\bit\b/, "Engineering"],
    [/doctor|medical|health|nurse|dentist|pharma/, "Healthcare"],
    [/finance|bank|account|chartered accountant|\bca\b/, "Finance"],
    [/business|entrepreneur|trader|self employed/, "Business"],
    [/manager|management|human resource|\bhr\b|administrator/, "Management"],
    [/government|govt|civil service|public sector/, "Government"],
    [/teacher|teaching|professor|lecturer|education/, "Teaching"],
    [/lawyer|advocate|legal|attorney/, "Legal"],
    [/marketing|sales|advertising/, "Marketing"],
    [/not working|homemaker|housewife|unemployed/, "Not Working"],
  ];

  for (let index = 0; index < mappings.length; index++) {
    if (mappings[index][0].test(normalized)) return mappings[index][1];
  }
  return "Other";
}

function parseSyncManglik_(value) {
  const normalized = syncText_(value).toLowerCase();
  if (["yes", "y", "true", "manglik"].indexOf(normalized) !== -1) {
    return true;
  }
  if (
    ["no", "n", "false", "non manglik", "non-manglik"].indexOf(
      normalized
    ) !== -1
  ) {
    return false;
  }
  return null;
}

function toSyncIsoDate_(value, timezone) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }

  const text = syncText_(value);
  const dayFirst = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dayFirst) {
    return (
      dayFirst[3] +
      "-" +
      String(dayFirst[2]).padStart(2, "0") +
      "-" +
      String(dayFirst[1]).padStart(2, "0")
    );
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? text : null;
}

function assertSyncResponse_(response, operation) {
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      operation + " failed: " + status + " " + response.getContentText()
    );
  }
}

function nullableSyncText_(value) {
  const text = syncText_(value);
  return text || null;
}

function syncText_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

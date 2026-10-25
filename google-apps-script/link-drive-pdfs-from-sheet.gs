const PDF_FOLDER_ID = "1UkYATIo4hWT-8jghJxU2FS2PzQ7CFQyc";
const PROFILE_SHEET_NAME = "Sheet1";

const PROFILE_ID_COLUMN = "Profile ID";
const NAME_COLUMN = "Name";
const PDF_LINK_COLUMN = "Profile PDF Link";

/**
 * Scans the Drive folder and creates, updates, or deletes Sheet rows using
 * Profile ID.
 *
 * Supported filenames:
 *   G1-Palak.pdf
 *   G2_Ruchi Jain.pdf
 *   B1 RahulAgarwal.pdf
 */
function syncPdfProfilesFromDrive() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log(
      "Drive synchronization skipped because another synchronization is running."
    );
    return;
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(PROFILE_SHEET_NAME);
    if (!sheet) {
      throw new Error("Missing sheet: " + PROFILE_SHEET_NAME);
    }

    const lastColumn = sheet.getLastColumn();
    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(cleanText_);

    const profileIdIndex = headers.indexOf(PROFILE_ID_COLUMN);
    const nameIndex = headers.indexOf(NAME_COLUMN);
    const pdfLinkIndex = headers.indexOf(PDF_LINK_COLUMN);

    if (profileIdIndex === -1 || nameIndex === -1 || pdfLinkIndex === -1) {
      throw new Error(
        'Sheet1 must contain "Profile ID", "Name", and "Profile PDF Link" columns.'
      );
    }

    const filesByProfileId = getProfilePdfs_();
    const profileIds = Object.keys(filesByProfileId).sort(compareProfileIds_);

    // Remove only rows previously linked to a PDF. This preserves manual or
    // incomplete rows that do not yet have a PDF link.
    deleteRowsForMissingPdfs_(
      sheet,
      profileIdIndex,
      pdfLinkIndex,
      filesByProfileId
    );

    // Rebuild this map after deletion because row numbers may have changed.
    const rowByProfileId = getExistingProfileRows_(sheet, profileIdIndex);

    if (!profileIds.length) {
      Logger.log("No correctly named PDFs were found in the Drive folder.");
    } else {
      profileIds.forEach(function(profileId) {
        const pdf = filesByProfileId[profileId];
        let rowNumber = rowByProfileId[profileId];

        if (!rowNumber) {
          const newRow = new Array(lastColumn).fill("");
          newRow[profileIdIndex] = profileId;
          newRow[nameIndex] = pdf.profileName;
          sheet.appendRow(newRow);
          rowNumber = sheet.getLastRow();
          rowByProfileId[profileId] = rowNumber;
        } else {
          // Keep the name synchronized with the newest matching PDF filename.
          sheet.getRange(rowNumber, nameIndex + 1).setValue(pdf.profileName);
        }

        const restrictionError = applyViewerRestrictions_(pdf.file);
        const pdfUrl =
          "https://drive.google.com/file/d/" + pdf.file.getId() + "/view";
        const linkCell = sheet.getRange(rowNumber, pdfLinkIndex + 1);

        linkCell.setFormula('=HYPERLINK("' + pdfUrl + '","View PDF")');
        linkCell.setNote(
          restrictionError
            ? "PDF linked, but its download restriction failed: " + restrictionError
            : "Viewer access enabled. Download, print, and copy are disabled for viewers."
        );
      });
    }
  } finally {
    lock.releaseLock();
  }

  // Changes made by Apps Script do not fire spreadsheet edit triggers.
  if (typeof syncSheetToSupabase === "function") {
    syncSheetToSupabase();
  }
}

/**
 * Deletes a linked Sheet row when no matching PDF remains in the Drive folder.
 * Rows without a PDF link are kept so manually entered or unfinished profiles
 * are not removed.
 */
function deleteRowsForMissingPdfs_(
  sheet,
  profileIdIndex,
  pdfLinkIndex,
  filesByProfileId
) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rowCount = lastRow - 1;
  const profileIds = sheet
    .getRange(2, profileIdIndex + 1, rowCount, 1)
    .getDisplayValues();
  const pdfLinks = sheet
    .getRange(2, pdfLinkIndex + 1, rowCount, 1)
    .getDisplayValues();
  const rowsToDelete = [];

  for (let offset = 0; offset < rowCount; offset++) {
    const profileId = normalizeProfileId_(profileIds[offset][0]);
    const hasPdfLink = Boolean(cleanText_(pdfLinks[offset][0]));

    if (profileId && hasPdfLink && !filesByProfileId[profileId]) {
      rowsToDelete.push(offset + 2);
      Logger.log("Deleting row for missing PDF: " + profileId);
    }
  }

  // Delete bottom-up so earlier row numbers do not move before deletion.
  rowsToDelete
    .sort(function(a, b) {
      return b - a;
    })
    .forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });
}

/**
 * Run once to check the Drive folder automatically every minute.
 */
function installPdfSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === "syncPdfProfilesFromDrive";
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("syncPdfProfilesFromDrive")
    .timeBased()
    .everyMinutes(1)
    .create();
}

function getProfilePdfs_() {
  const folder = DriveApp.getFolderById(PDF_FOLDER_ID);
  const files = folder.getFiles();
  const result = {};

  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() !== MimeType.PDF) continue;

    const parsed = parseProfileFileName_(file.getName());
    if (!parsed) {
      Logger.log("Skipped incorrectly named file: " + file.getName());
      continue;
    }

    const existing = result[parsed.profileId];
    if (!existing || file.getLastUpdated() > existing.file.getLastUpdated()) {
      result[parsed.profileId] = {
        file: file,
        profileName: parsed.profileName,
      };
    }
  }

  return result;
}

function parseProfileFileName_(fileName) {
  const match = cleanText_(fileName).match(
    /^([GB])\s*0*(\d+)\s*[-_ ]\s*(.+?)\.pdf$/i
  );
  if (!match) return null;

  const profileId = match[1].toUpperCase() + String(Number(match[2]));
  const profileName = match[3]
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return profileName ? { profileId: profileId, profileName: profileName } : null;
}

function getExistingProfileRows_(sheet, profileIdIndex) {
  const result = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;

  const values = sheet
    .getRange(2, profileIdIndex + 1, lastRow - 1, 1)
    .getDisplayValues();

  values.forEach(function(row, offset) {
    const profileId = normalizeProfileId_(row[0]);
    if (profileId && !result[profileId]) {
      result[profileId] = offset + 2;
    }
  });

  return result;
}

function normalizeProfileId_(value) {
  const match = cleanText_(value).match(/^([GB])\s*0*(\d+)$/i);
  return match
    ? match[1].toUpperCase() + String(Number(match[2]))
    : "";
}

function compareProfileIds_(a, b) {
  const typeComparison = a[0].localeCompare(b[0]);
  return typeComparison || Number(a.slice(1)) - Number(b.slice(1));
}

function applyViewerRestrictions_(file) {
  try {
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

    // Requires the Advanced Drive service: Apps Script > Services > Drive API.
    Drive.Files.update(
      { copyRequiresWriterPermission: true },
      file.getId(),
      { supportsAllDrives: true }
    );

    return "";
  } catch (error) {
    Logger.log(
      "Could not apply viewer restrictions to " +
        file.getName() +
        ": " +
        error.message
    );
    return error.message;
  }
}

function cleanText_(value) {
  return String(value || "").trim();
}

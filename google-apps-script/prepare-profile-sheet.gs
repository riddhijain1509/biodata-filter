const SHEET_SETUP_SHEET_NAME = "Sheet1";
const SHEET_SETUP_MAX_VALIDATION_ROWS = 5000;

const SHEET_SETUP_OCCUPATIONS = [
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

const SHEET_SETUP_CASTES = [
  "GUPTA",
  "AGRAWAL",
  "JAIN",
  "OTHERS",
];

const SHEET_SETUP_MANGLIK_OPTIONS = ["Yes", "No"];
const SHEET_SETUP_DOB_DAYS = Array.from({ length: 31 }, function(_, index) {
  return String(index + 1);
});
const SHEET_SETUP_DOB_MONTHS = Array.from({ length: 12 }, function(_, index) {
  return String(index + 1);
});

/**
 * Run once from Apps Script to prepare the existing profile sheet.
 *
 * This function does not delete columns or profile rows. It keeps extra fields
 * such as Mobile No and Gender untouched. Signup-user mobile numbers belong in
 * Supabase user_profiles and must never be written into this sheet.
 */
function prepareProfileSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_SETUP_SHEET_NAME);

  if (!sheet) {
    throw new Error("Missing sheet: " + SHEET_SETUP_SHEET_NAME);
  }

  renameHeaderIfPresent_(sheet, "Hight (0.00)", "Height");
  renameHeaderIfPresent_(sheet, "Current District", "Posting District");

  const requiredHeaders = [
    "Profile ID",
    "Name",
    "Profile PDF Link",
    "Height",
    "Income",
    "Family District",
    "Posting District",
    "Caste",
    "DOB Day",
    "DOB Month",
    "DOB Year",
    "Occupation",
    "Manglik",
  ];

  let headers = getSetupHeaders_(sheet);
  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers = getSetupHeaders_(sheet);
    }
  });

  const columnByHeader = {};
  headers.forEach(function(header, index) {
    if (header && !columnByHeader[header]) {
      columnByHeader[header] = index + 1;
    }
  });

  const validationRowCount = Math.max(
    SHEET_SETUP_MAX_VALIDATION_ROWS - 1,
    sheet.getMaxRows() - 1
  );
  if (sheet.getMaxRows() < validationRowCount + 1) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      validationRowCount + 1 - sheet.getMaxRows()
    );
  }

  applyProfileIdValidation_(
    sheet,
    columnByHeader["Profile ID"],
    validationRowCount
  );
  applyHeightValidation_(sheet, columnByHeader.Height, validationRowCount);
  applyIncomeValidation_(sheet, columnByHeader.Income, validationRowCount);
  if (columnByHeader.DOB) {
    applyDateValidation_(sheet, columnByHeader.DOB, validationRowCount);
  }
  applyListValidation_(
    sheet,
    columnByHeader["DOB Day"],
    validationRowCount,
    SHEET_SETUP_DOB_DAYS,
    "Choose the day of birth."
  );
  applyListValidation_(
    sheet,
    columnByHeader["DOB Month"],
    validationRowCount,
    SHEET_SETUP_DOB_MONTHS,
    "Choose the month of birth."
  );
  applyListValidation_(
    sheet,
    columnByHeader["DOB Year"],
    validationRowCount,
    getDobYearOptions_(),
    "Choose the year of birth."
  );
  applyListValidation_(
    sheet,
    columnByHeader.Occupation,
    validationRowCount,
    SHEET_SETUP_OCCUPATIONS,
    "Choose one occupation category. Existing non-category values are kept but must be corrected."
  );
  applyListValidation_(
    sheet,
    columnByHeader.Caste,
    validationRowCount,
    SHEET_SETUP_CASTES,
    "Choose a caste category, or Others when it is not listed."
  );
  applyListValidation_(
    sheet,
    columnByHeader.Manglik,
    validationRowCount,
    SHEET_SETUP_MANGLIK_OPTIONS,
    "Choose Yes or No."
  );

  sheet.setFrozenRows(1);
  styleSetupHeader_(sheet);
  addSetupHeaderNotes_(sheet, columnByHeader);

  Logger.log(
    "Profile sheet prepared. Existing rows and extra columns were preserved."
  );
}

function getDobYearOptions_() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 1940; year <= currentYear; year++) years.push(String(year));
  return years;
}

/**
 * One-time migration: copy existing DOB values into the three DOB dropdown columns.
 * The original DOB column is never changed or cleared.
 */
function backfillDobParts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETUP_SHEET_NAME);
  if (!sheet) throw new Error("Missing sheet: " + SHEET_SETUP_SHEET_NAME);

  const headers = getSetupHeaders_(sheet);
  const columns = {
    dob: headers.indexOf("DOB") + 1,
    day: headers.indexOf("DOB Day") + 1,
    month: headers.indexOf("DOB Month") + 1,
    year: headers.indexOf("DOB Year") + 1,
  };
  if (Object.values(columns).some(function(column) { return column === 0; })) {
    throw new Error("Run prepareProfileSheet() first to add the DOB columns.");
  }

  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (!rowCount) return;

  const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  const dobValues = sheet.getRange(2, columns.dob, rowCount, 1).getValues();
  const dayValues = sheet.getRange(2, columns.day, rowCount, 1).getValues();
  const monthValues = sheet.getRange(2, columns.month, rowCount, 1).getValues();
  const yearValues = sheet.getRange(2, columns.year, rowCount, 1).getValues();

  dobValues.forEach(function(row, index) {
    const parts = splitDobParts_(row[0], timezone);
    if (!parts) return;
    if (!dayValues[index][0]) dayValues[index][0] = parts.day;
    if (!monthValues[index][0]) monthValues[index][0] = parts.month;
    if (!yearValues[index][0]) yearValues[index][0] = parts.year;
  });

  sheet.getRange(2, columns.day, rowCount, 1).setValues(dayValues);
  sheet.getRange(2, columns.month, rowCount, 1).setValues(monthValues);
  sheet.getRange(2, columns.year, rowCount, 1).setValues(yearValues);
  Logger.log("Existing DOB values were copied into the DOB Day, DOB Month, and DOB Year columns.");
}

function splitDobParts_(value, timezone) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return {
      day: String(value.getDate()),
      month: String(value.getMonth() + 1),
      year: String(value.getFullYear()),
    };
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (!match) return null;
  return { day: String(Number(match[1])), month: String(Number(match[2])), year: match[3] };
}

function renameHeaderIfPresent_(sheet, oldHeader, newHeader) {
  const headers = getSetupHeaders_(sheet);
  const oldIndex = headers.indexOf(oldHeader);
  const newIndex = headers.indexOf(newHeader);

  if (oldIndex !== -1 && newIndex === -1) {
    sheet.getRange(1, oldIndex + 1).setValue(newHeader);
  }
}

function getSetupHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(value) {
      return String(value || "").trim();
    });
}

function applyProfileIdValidation_(sheet, column, rowCount) {
  const columnLetter = setupColumnLetter_(column);
  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(
      '=OR(' +
        columnLetter +
        '2="",REGEXMATCH(TO_TEXT(' +
        columnLetter +
        '2),"^[GB][1-9][0-9]*$"))'
    )
    .setAllowInvalid(false)
    .setHelpText("Use G1, G2, B1, B2, and so on.")
    .build();

  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function applyHeightValidation_(sheet, column, rowCount) {
  const options = ["4"];
  for (let feet = 4; feet <= 6; feet++) {
    for (let inches = 1; inches <= 11; inches++) {
      options.push(feet + "." + String(inches).padStart(2, "0"));
    }
    if (feet < 6) options.push(String(feet + 1));
  }
  options.push("7");

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)
    .setHelpText(
      "Choose 4 for 4 ft and below, 4.01 through 6.11, or 7 for 7 ft and above. Existing 5.03 means 5 ft 3 in."
    )
    .build();

  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function applyIncomeValidation_(sheet, column, rowCount) {
  const options = [];
  for (let lpa = 1; lpa <= 50; lpa++) options.push(String(lpa));
  options.push("50+");

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)
    .setHelpText("Choose annual income in lakhs from 1 to 50, or 50+ for higher income.")
    .build();

  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function applyDateValidation_(sheet, column, rowCount) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireDateOnOrBefore(new Date())
    .setAllowInvalid(true)
    .setHelpText("Enter a valid date of birth.")
    .build();

  sheet
    .getRange(2, column, rowCount, 1)
    .setDataValidation(rule)
    .setNumberFormat("dd-mm-yyyy");
}

function applyListValidation_(
  sheet,
  column,
  rowCount,
  allowedValues,
  helpText
) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allowedValues, true)
    .setAllowInvalid(true)
    .setHelpText(helpText)
    .build();

  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function styleSetupHeader_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange
    .setFontWeight("bold")
    .setBackground("#14263d")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);
}

function addSetupHeaderNotes_(sheet, columnByHeader) {
  sheet
    .getRange(1, columnByHeader["Profile ID"])
    .setNote("Permanent unique ID. Use G1, G2, B1, B2, and so on.");
  sheet
    .getRange(1, columnByHeader.Height)
    .setNote(
      "Preferred: centimetres. Existing decimal notation such as 5.03 is interpreted as 5 ft 3 in."
    );
  sheet
    .getRange(1, columnByHeader.Income)
    .setNote("Annual income in LPA. Example: enter 18.5 for 18.5 LPA.");
  sheet
    .getRange(1, columnByHeader.Occupation)
    .setNote("Select one standard occupation category from the dropdown.");
  sheet
    .getRange(1, columnByHeader.Manglik)
    .setNote("Select Yes or No from the dropdown.");
}

function setupColumnLetter_(columnNumber) {
  let number = columnNumber;
  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

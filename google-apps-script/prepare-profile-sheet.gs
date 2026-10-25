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

const SHEET_SETUP_MANGLIK_OPTIONS = ["Yes", "No"];

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
    "DOB",
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
  applyDateValidation_(sheet, columnByHeader.DOB, validationRowCount);
  applyListValidation_(
    sheet,
    columnByHeader.Occupation,
    validationRowCount,
    SHEET_SETUP_OCCUPATIONS,
    "Choose one occupation category. Existing non-category values are kept but must be corrected."
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
  const columnLetter = setupColumnLetter_(column);
  const cell = columnLetter + "2";
  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(
      "=OR(" +
        cell +
        '="",AND(ISNUMBER(' +
        cell +
        "),OR(AND(" +
        cell +
        ">=120," +
        cell +
        "<=220),AND(" +
        cell +
        ">=4," +
        cell +
        "<8,ROUND(MOD(" +
        cell +
        ",1)*100,0)<=11))))"
    )
    .setAllowInvalid(true)
    .setHelpText(
      "Preferred: centimetres, for example 160. Existing 5.03 means 5 ft 3 in."
    )
    .build();

  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function applyIncomeValidation_(sheet, column, rowCount) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(true)
    .setHelpText("Enter annual income in LPA, for example 12, 18.5, or 30.")
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

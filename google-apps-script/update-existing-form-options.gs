const FORM_ID = "1SDSJj4nlxgmLJ-VuWT3dIe6-zV2GGzt-pYNWyGImkVQ";

function updateExistingBiodataFormOptions() {
  const form = FormApp.openById(FORM_ID);

  replaceOrUpdateDropdown_(form, "Religion", [
    "Hindu",
    "Jain",
    "Sikh",
    "Muslim",
    "Christian",
    "Buddhist",`
    "Other",
    "Prefer not to say",
  ]);

  replaceOrUpdateDropdown_(form, "Gotra", [
    "Airen",
    "Bansal",
    "Bindal",
    "Dharan",
    "Garg",
    "Goel",
    "Goyal",
    "Kansal",
    "Kuchhal",
    "Mangal",
    "Mittal",
    "Nangal",
    "Singhal",
    "Tayal",
    "Tingal",
    "Jindal",
    "Jain",
    "Poddar",
    "Other",
    "Not listed",
  ]);

  replaceOrUpdateDropdown_(form, "Caste / Community", [
    "Agarwal",
    "Agrawal",
    "Jain",
    "Baniya",
    "Gupta",
    "Maheshwari",
    "Khandelwal",
    "Marwari",
    "Brahmin",
    "Rajput",
    "Kayastha",
    "Punjabi",
    "Other",
    "Prefer not to say",
  ]);

  replaceOrUpdateDropdown_(form, "Height", buildHeightChoices_());

  addTextIfMissing_(form, "Religion Other Details", "Fill this only if Religion is Other.");
  addTextIfMissing_(form, "Gotra Other Details", "Fill this only if Gotra is Other or not listed.");
  addTextIfMissing_(form, "Caste / Community Other Details", "Fill this only if Caste / Community is Other.");

  Logger.log("Updated form: " + form.getEditUrl());
}

function replaceOrUpdateDropdown_(form, title, choices) {
  const item = findItemByTitle_(form, title);
  if (!item) {
    form.addListItem()
      .setTitle(title)
      .setChoiceValues(choices)
      .setRequired(false);
    return;
  }

  if (item.getType() === FormApp.ItemType.LIST) {
    item.asListItem().setChoiceValues(choices);
    return;
  }

  item.setTitle(title + " Old Text");
  form.addListItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(false);
}

function addTextIfMissing_(form, title, helpText) {
  if (findItemByTitle_(form, title)) return;
  form.addTextItem().setTitle(title).setHelpText(helpText).setRequired(false);
}

function findItemByTitle_(form, title) {
  return form.getItems().find((item) => item.getTitle() === title);
}

function buildHeightChoices_() {
  const choices = ["Not listed"];
  for (let feet = 4; feet <= 6; feet += 1) {
    const startInch = feet === 4 ? 6 : 0;
    const endInch = feet === 6 ? 4 : 11;
    for (let inches = startInch; inches <= endInch; inches += 1) {
      const totalInches = feet * 12 + inches;
      const cm = Math.round(totalInches * 2.54);
      choices.push(feet + "'" + inches + "\" (" + cm + " cm)");
    }
  }
  return choices;
}

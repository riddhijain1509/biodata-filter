function createBiodataGoogleForm() {
  const form = FormApp.create("Biodata Submission Form");
  form.setDescription("Submit structured biodata details and upload the original biodata PDF.");
  form.setCollectEmail(true);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage("Thank you. Your biodata has been submitted for review.");

  addText_(form, "Profile ID", false, "Optional. Leave blank if the admin will assign this.");
  addText_(form, "Full Name", true, "Example: Dr. Isha Jain");
  addDropdown_(form, "Gender", true, ["Female", "Male", "Other"]);
  form.addDateItem().setTitle("Date of Birth").setRequired(true);
  addText_(form, "Birth Time", false, "Example: 09:07 AM");
  addText_(form, "Birth Place", false, "Example: Noida");
  addDropdown_(form, "Height", false, buildHeightChoices_());
  addDropdown_(form, "Gotra", true, [
    "Airen",
    "Bansal",
    "Bindal",
    "Dharan",
    "Bansal",
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
  addText_(form, "Gotra Other Details", false, "Fill this only if Gotra is Other or not listed.");
  addText_(form, "Surname", false, "Example: Jain");
  addDropdown_(form, "Religion", false, [
    "Hindu",
    "Jain",
    "Sikh",
    "Muslim",
    "Christian",
    "Buddhist",
    "Other",
    "Prefer not to say",
  ]);
  addText_(form, "Religion Other Details", false, "Fill this only if Religion is Other.");
  addDropdown_(form, "Caste / Community", false, [
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
  addText_(form, "Caste / Community Other Details", false, "Fill this only if Caste / Community is Other.");
  addDropdown_(form, "Manglik", false, ["No", "Yes", "Not sure", "Not applicable"]);
  addDropdown_(form, "Marital Status", false, ["Never Married", "Divorced", "Widowed", "Other"]);
  addText_(form, "Current City", false, "Example: Noida");
  addText_(form, "District", false, "Example: Gautam Buddha Nagar");
  addText_(form, "State", false, "Example: Uttar Pradesh");

  form.addParagraphTextItem()
    .setTitle("Education Raw")
    .setHelpText("Write full education details as submitted. Example: MBBS; MS General Surgery, UCMS Delhi")
    .setRequired(true);

  addDropdown_(form, "Education Level", true, [
    "School",
    "Diploma",
    "Graduate",
    "Postgraduate",
    "Doctorate",
    "Professional",
    "Other",
  ]);

  addDropdown_(form, "Education Stream", true, [
    "Engineering",
    "Medical",
    "Commerce",
    "Management",
    "Law",
    "Arts",
    "Science",
    "Education",
    "Design",
    "Finance",
    "Other",
  ]);

  addText_(form, "Profession Raw", false, "Example: Doctor, General Surgery");
  addDropdown_(form, "Profession Category", false, [
    "Doctor",
    "Engineer",
    "Business",
    "Teacher",
    "Lawyer",
    "Finance",
    "Management",
    "Government",
    "Not Working",
    "Student",
    "Other",
  ]);

  addText_(form, "Company / Business", false, "Example: Barclays");
  form.addParagraphTextItem().setTitle("Family Details").setRequired(false);
  addText_(form, "Contact Person", false, "Example: Father / Guardian name");
  addText_(form, "Contact Number", false, "Example: +91 9876543210");
  addText_(form, "Email", false, "Example: name@example.com");
  form.addParagraphTextItem().setTitle("Address").setRequired(false);

  addText_(
    form,
    "Biodata PDF Drive Link",
    false,
    "If you add a File upload question manually, you can delete this field later. Otherwise paste the Google Drive PDF link here."
  );

  form.addCheckboxItem()
    .setTitle("Consent to Store and Display Biodata")
    .setChoiceValues(["Yes, I consent"])
    .setRequired(true);

  const sheet = SpreadsheetApp.create("Biodata Form Responses");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log("Form edit URL: " + form.getEditUrl());
  Logger.log("Form public URL: " + form.getPublishedUrl());
  Logger.log("Response sheet URL: " + sheet.getUrl());
}

function addText_(form, title, required, helpText) {
  const item = form.addTextItem().setTitle(title).setRequired(required);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function addDropdown_(form, title, required, choices) {
  return form.addListItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(required);
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

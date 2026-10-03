# Google Form Fields

Use fixed options where possible. This keeps filtering accurate and avoids spelling cleanup later.

## Required Fields

| Form label | Sheet column | Type |
| --- | --- | --- |
| Profile ID | `profile_id` | Short answer or generated later |
| Full Name | `full_name` | Short answer |
| Gender | `gender` | Dropdown |
| Date of Birth | `date_of_birth` | Date |
| Birth Time | `birth_time` | Short answer |
| Birth Place | `birth_place` | Short answer |
| Height | `height` | Dropdown, stored as cm during sync |
| Gotra | `gotra` | Dropdown plus Other |
| Surname | `surname` | Short answer |
| Religion | `religion` | Dropdown |
| Caste / Community | `caste` | Dropdown |
| Manglik | `manglik` | Dropdown |
| Marital Status | `marital_status` | Dropdown |
| Current City | `current_city` | Short answer |
| District | `district` | Short answer |
| State | `state` | Short answer |
| Education Raw | `education_raw` | Paragraph |
| Education Level | `education_level` | Dropdown |
| Education Stream | `education_stream` | Dropdown |
| Profession Raw | `profession_raw` | Short answer |
| Profession Category | `profession_category` | Dropdown |
| Company / Business | `company_business` | Short answer |
| Family Details | `family_details` | Paragraph |
| Contact Person | `contact_person` | Short answer |
| Contact Number | `contact_number` | Short answer |
| Email | `email` | Short answer |
| Address | `address` | Paragraph |
| Biodata PDF | `pdf_upload` | File upload |
| Consent to Store and Display Biodata | `consent` | Checkbox |

## Recommended Dropdown Options

### Education Level

- School
- Diploma
- Graduate
- Postgraduate
- Doctorate
- Professional
- Other

### Education Stream

- Engineering
- Medical
- Commerce
- Management
- Law
- Arts
- Science
- Education
- Design
- Finance
- Other

### Profession Category

- Doctor
- Engineer
- Business
- Teacher
- Lawyer
- Finance
- Management
- Government
- Not Working
- Student
- Other

## PDF Upload

Google Forms will store uploaded PDFs in Google Drive. The linked response sheet receives the Drive file link. The sync script extracts:

- file id
- file name where available
- Drive URL

Keep the PDF private during collection. For the MVP, the website can open the Drive URL for users who have permission. For a public or semi-public website, add login and use safer file permissions.

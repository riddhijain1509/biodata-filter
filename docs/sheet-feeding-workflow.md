# Sheet Feeding Workflow

The working sheet uses exactly eight columns, in this order:

| Column | Purpose |
| --- | --- |
| `Name` | Profile name |
| `Profile PDF Link` | Filled automatically from Google Drive |
| `Height` | Height in feet/inches or centimetres |
| `Income` | Annual income or income range |
| `Family District` | Family's home district |
| `Current District` | Present district or city |
| `Caste` | Caste/community |
| `DOB` | Date of birth |

## PDF naming

The first data row is profile 1, the second data row is profile 2, and so on. The PDF filename must begin with that profile number followed by a hyphen, underscore, or space.

Examples for the first data row:

```text
1-RuchiJain.pdf
1_RuchiJain.pdf
1 RuchiJain.pdf
```

## Automatic Drive linking

Use `google-apps-script/link-drive-pdfs-from-sheet.gs` in the spreadsheet's Apps Script project.

1. Set `PDF_FOLDER_ID` from the Drive folder URL.
2. In Apps Script, open **Services**, add **Drive API**, and save.
3. Run `installPdfAutoLinkTrigger` once and approve the requested Google permissions.
4. The script checks the folder every minute. When it finds a matching PDF, it creates the corresponding profile row, fills `Name` from the filename, and fills `Profile PDF Link`.

The script gives anyone with the link viewer access and enables Drive's restriction that hides download, print, and copy actions for viewers and commenters.

## Row-order warning

Because PDF matching uses the profile's position, do not sort or move populated rows after PDFs have been named. Add new profiles at the bottom. If rows must be reordered later, rename the PDFs to match the new profile numbers.

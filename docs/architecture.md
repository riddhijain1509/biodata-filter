# Biodata Filter Architecture

This version uses Google Forms for intake, Google Sheets as the immediate response log, Google Drive for PDFs, Supabase/PostgreSQL for searchable profile data, and Vercel for the frontend.

## Flow

1. A family fills the Google Form.
2. The form writes a row into the linked Google Sheet.
3. The PDF upload is stored in Google Drive, and the sheet row includes the uploaded file link.
4. A Google Apps Script trigger runs on each form submission.
5. The script normalizes important fields and upserts the record into Supabase.
6. The Vercel frontend queries Supabase and applies filters/ranking.
7. The user sees only matching profiles and can open the PDF link.

## Why PDFs Stay In Drive

Excel and Google Sheets should not store PDFs directly. They should store a link or file id. The original file belongs in Drive or object storage, and the searchable values belong in the database.

For the first private version, keep PDFs in Google Drive and store:

- `pdf_file_id`
- `pdf_url`
- `pdf_name`

Later, for stricter access control, copy PDFs into Supabase Storage or S3 and generate signed links only for logged-in users.

## Main Pieces

| Piece | Tool | Job |
| --- | --- | --- |
| Intake | Google Form | Collect structured biodata fields and PDF upload |
| Raw log | Google Sheet | Keep every response exactly as submitted |
| PDF storage | Google Drive | Store original biodata PDFs |
| Sync | Google Apps Script | Push new/edited rows to Supabase |
| Database | Supabase/PostgreSQL | Store cleaned searchable profile records |
| Frontend | Vercel | Host the filter/search UI |

## Matching Strategy

The database stores both original text and normalized values.

Example:

- `education_raw`: `B.Tech in Electronics and Communication`
- `education_level`: `Graduate`
- `education_stream`: `Engineering`
- `education_tags`: `engineering,electronics,communication,btech`

Filters use normalized values first. Fuzzy matching is used for free-text search and spelling differences.

## Education Matching

Education should be matched by category, not only by spelling.

| Raw value examples | Level | Stream |
| --- | --- | --- |
| B.Tech, B.E., Bachelor of Technology | Graduate | Engineering |
| MBBS, MD, MS Surgery, BDS | Medical / Postgraduate where applicable | Medical |
| B.Com, M.Com, CA | Graduate / Postgraduate / Professional | Commerce / Finance |
| MBA, PGDM | Postgraduate | Management |
| LLB, LLM, Advocate | Graduate / Postgraduate / Professional | Law |
| B.Ed, M.Ed, Teacher | Graduate / Postgraduate | Education |

The Google Form should use dropdowns wherever possible to reduce spelling issues. Keep an `Other` text field only when needed.

## Gotra Matching

Gotra needs two modes:

- Include selected gotra
- Exclude selected gotra

Many users may want to hide same gotra rather than search for it. The frontend should keep this explicit.

## Hosting Plan

For MVP:

- Static frontend on Vercel
- Supabase table for profile records
- Google Drive PDF links opened from profile cards

For production:

- Add login
- Add admin approval before a profile appears publicly
- Keep PDF access private
- Move matching/ranking into API routes if the dataset becomes large

# Supabase + Vercel Setup

This is the setup order for the free-tier MVP.

## 1. Create Supabase Project

1. Create a free Supabase project.
2. Open the SQL editor.
3. Run `database/schema.sql`.
4. Confirm the `biodata_profiles` table exists.

The frontend only reads rows where `approved = true`. New Google Form submissions are saved with `approved = false`, so you can review them before they appear.

## 2. Get Supabase Keys

From Supabase project settings:

- Project URL
- Anon public key
- Service role key

Use the anon key in the frontend. Use the service role key only in Google Apps Script. Do not put the service role key in Vercel frontend code.

## 3. Configure the Website Locally

Edit `config.js`:

```js
export const config = {
  supabaseUrl: "https://your-project.supabase.co",
  supabaseAnonKey: "your-anon-public-key",
};
```

Until these are filled, the website keeps using sample local records from `profiles.js`.

## 4. Create Google Form and Sheet

Use the fields in `docs/google-form-fields.md`.

The response sheet column names should match the listed `Sheet column` values when possible. The Apps Script also accepts the human labels for the most important columns.

## 5. Add Apps Script Sync

1. Open the Google Sheet.
2. Go to Extensions > Apps Script.
3. Paste `google-apps-script/sync-to-supabase.gs`.
4. Add script properties:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Add an installable trigger:
   - Function: `onFormSubmit`
   - Event source: From spreadsheet
   - Event type: On form submit

Now each new form submission will upsert a row into Supabase.

## 6. Approve Test Rows

In Supabase, set `approved = true` for a test profile. The website should then show it from Supabase.

## 7. Host on Vercel

1. Push this folder to a GitHub repository.
2. Create a new Vercel project from that repository.
3. Use the default static settings.
4. Deploy.

The free Vercel URL will look like:

```text
https://your-project.vercel.app
```

## 8. PDF Links

Google Forms uploads PDFs into Google Drive. The sync script stores the Drive URL in `pdf_url`.

For MVP, set Drive sharing so intended users can open the file. For stricter privacy later, add login and generate protected file access.

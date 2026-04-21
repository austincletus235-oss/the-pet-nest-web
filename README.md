# The Pet Nest Web (Supabase Live)

This frontend reads pet listings directly from Supabase (`pets` table).

## Files
- `index.html`
- `style.css`
- `app.js`

## Setup
1. In `app.js`, set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Ensure Supabase table `pets` has columns:
- id
- name
- price
- category
- section
- media_url
- status
- created_at

3. Add public read policy (RLS) for website access.

## GitHub Pages
- Deploy from branch: `main`
- Folder: `/(root)`

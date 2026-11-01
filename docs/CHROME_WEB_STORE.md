# Publishing the Ascend extension in the Chrome Web Store

Goal: students click **Add to Chrome** and it installs like any other extension.
No zip, no Developer mode. The download on `/extension` is only the early-access
route until this is live.

Expect: a $5 one-time fee, then a review that usually takes a few days (it can
take a couple of weeks for a first submission).

## 0. Before you submit: test it yourself (15 minutes)

Do this with the build you will upload, from the project folder:

    cd extension
    npm install
    npm run package

Then in Chrome: `chrome://extensions` -> Developer mode -> **Load unpacked** ->
pick the `extension/dist` folder. Check each of these:

- [ ] Sign in with your **Ascend email and password**. It works.
- [ ] Sign in with **Continue with Google** (see step 4 first). It opens a tab,
      then says "You're signed in".
- [ ] On a real **LinkedIn job page**, click the icon. Company, role and
      description are filled in. Press **Save to Ascend**.
- [ ] On an **Indeed job page**, the same.
- [ ] In Ascend, the new role is in Roles with its **link back to the posting**
      and the source (LinkedIn or Indeed).
- [ ] On a page that is not a job (any site), the form is blank and saving still
      works by typing.
- [ ] **Log out** works.

If something fails, do not submit. Tell me what you saw.

## 1. Create the developer account

1. Go to https://chrome.google.com/webstore/devconsole and sign in. Use a Google
   account you will keep long term (ideally a dedicated one for Ascend, not a
   personal one).
2. Pay the one-time **$5** registration fee.
3. Turn on 2-step verification on that account (the store requires it to
   publish) and verify your contact email in the dashboard settings.

## 2. Upload the package

1. **Add new item**, then upload `public/ascend-extension.zip`
   (made by `npm run package`).
2. The manifest is already store-ready: Manifest V3, icons at 16/48/128, and no
   remotely hosted code (everything is bundled).

Updating later: bump `version` in `extension/manifest.json` and
`extension/package.json`, run `npm run package`, and upload the new zip.

## 3. Store listing (copy and paste)

**Name** (keep it free of other companies' trademarks)

    Ascend: Save Jobs to Your Tracker

**Summary** (max 132 characters)

    Save LinkedIn and Indeed job postings to your Ascend tracker in one click, then check how well your resume fits.

**Description**

    Stop retyping job postings.

    With Ascend, open a job on LinkedIn or Indeed, click the Ascend icon, and the company, role and description are filled in for you. Check them, press Save, and the job is added to your Roles list in Ascend with a link back to the original posting.

    Then, in Ascend, upload your resume and see how well it matches that job, which required skills you are missing, and what to fix first.

    How it works
    - Open a job posting on LinkedIn or Indeed.
    - Click the Ascend icon. Sign in once (email and password, or Google).
    - Review the details it filled in, and press Save to Ascend.

    Your privacy
    - It only runs on LinkedIn and Indeed job pages.
    - It reads the job details on the page you have open to fill in the form. Nothing leaves your browser until you press Save.
    - It does not read other sites or your browsing history.

    You need a free Ascend account: https://ascendcareers.app

    Ascend is an independent product and is not affiliated with LinkedIn or Indeed.

**Category:** Productivity. **Language:** English.

**Homepage URL:** `https://ascendcareers.app`  
**Support URL / email:** your contact email from the privacy page.

## 4. Sign-in with Google needs one setting in Supabase

The extension signs in through Supabase, and Supabase only sends people back to
addresses it has been told about. Each extension has its own ID, so:

1. Load the extension (unpacked) and copy its **ID** from `chrome://extensions`.
2. In Supabase: **Authentication -> URL Configuration -> Redirect URLs** -> add
   `https://<that ID>.chromiumapp.org/`
3. After the first upload to the store (a draft is enough), the store gives the
   extension its **permanent ID**. Add `https://<store ID>.chromiumapp.org/` the
   same way. Keep both.

Use the exact addresses, not a wildcard, so only your extension can receive a
sign-in.

## 5. Privacy tab (answers)

**Single purpose**

    Save a job posting the user is viewing on LinkedIn or Indeed into their own Ascend job tracker.

**Permission justifications**

| Permission | Why |
| --- | --- |
| `storage` | Keeps the user's Ascend sign-in session in the extension so they only sign in once. |
| `activeTab` | Reads the address of the tab the user is on when they click the icon, to save a link back to the job. |
| `identity` | Opens the Google sign-in window for "Continue with Google". |
| Host: `https://dwiwayffvlbokffyyuwy.supabase.co/*` | Talks to Ascend's database to sign in and save the job to the user's account. |
| Content scripts on `linkedin.com/jobs/*` and `indeed.com/*` | Reads the job title, company and description on the job page the user has open, to pre-fill the save form. |

**Remote code:** No. All code is bundled in the package.

**Data usage** (tick these, and nothing else)

- **Website content**: the job title, company and description on the page.
- **Authentication information**: the user's sign-in for their Ascend account.

**Certify all three**: the data is not sold; not used for anything unrelated to
the single purpose; not used for creditworthiness or lending.

**Privacy policy URL:** `https://ascendcareers.app/privacy`

## 6. Images

- **Store icon 128x128:** already in the package (`extension/icons/icon128.png`).
- **Small promo tile 440x280:** `docs/store-assets/promo-tile-440x280.png`.
- **Screenshots (at least 1, up to 5), 1280x800:** take these yourself from the
  real extension so they are accurate, since the store rejects mock-ups:
  1. A LinkedIn job page with the Ascend popup open and the form filled in.
  2. The "Saved to Ascend" screen.
  3. The saved role in Ascend with the link to the posting.
  Tip: set your browser window to 1280x800 (or crop to that ratio), then
  screenshot. Blur anything personal.

## 7. Visibility, then submit

Choose **Unlisted** for the first release: only people with the link can install
it, which is right while you have a handful of testers. Switch to **Public**
when you are ready for anyone to find it.

Press **Submit for review**. You will get an email when it is approved or if
they ask for changes (the usual reasons: a permission that is not justified, a
privacy policy that does not mention the extension, or a screenshot that does
not match).

## 8. After it is approved

1. Copy the store page address.
2. In Render, open the frontend service `ascend-app` -> Environment -> add
   `VITE_EXTENSION_STORE_URL` with that address -> save, then redeploy.
3. The site then shows **Add to Chrome** as the main button on `/extension`, and
   adds a "Chrome extension" link to the footer and the account menu.

## Notes

- LinkedIn's terms discourage automated scraping. This extension only reads the
  page the user is viewing, on their click, and saves it to their own account,
  which is much milder, but read LinkedIn's terms before promoting it widely.
- The extension needs no changes to the website's backend.

# Ascend browser extension

Manifest V3 Chrome extension that saves a LinkedIn or Indeed job posting
straight into your [Ascend](https://ascend-app-60ef.onrender.com) Roles
tracker, instead of retyping company/role/JD by hand.

## What it does

- **Popup login** — signs in with your existing Ascend email/password via
  Supabase Auth (`supabase.auth.signInWithPassword`), same as the web app's
  login page. The session is persisted in `chrome.storage.local` (extensions
  don't share page `localStorage`, so the Supabase client uses a small custom
  storage adapter — see `src/supabaseClient.js`).
- **Auto-capture** — on a LinkedIn job page (`linkedin.com/jobs/...`) or an
  Indeed job page, a content script best-effort scrapes the job title,
  company, and description via DOM selectors. It never throws: if the page's
  markup doesn't match any known selector, it just reports "couldn't
  auto-detect" and the popup falls back to a blank manual-entry form.
- **Editable preview + save** — the popup shows whatever was captured (or a
  blank form on unsupported pages) with every field editable, then inserts
  directly into the `roles` table using the same column shape as
  `addManualTrackerItem` in `src/features/tracker/hooks/useTracker.ts`
  (`status: "Wishlist"`, `alignment: 0`, client-generated `id`, etc.).
- **Success / error states** — on success, a "View in Ascend" button opens
  `https://ascend-app-60ef.onrender.com/roles` in a new tab. On failure (not
  logged in, RLS rejection, network error) the Supabase error message is
  shown inline.

## Project layout

```
extension/
  manifest.json        Manifest V3 config (static, copied as-is into dist/)
  build.js              esbuild build script
  package.json          extension's own deps/scripts (like server/ has)
  src/                   source that gets bundled
    background.js        thin MV3 service worker (badge only — see comments)
    content-linkedin.js   content script for linkedin.com/jobs/*
    content-indeed.js     content script for indeed.com/*
    extract.js            shared defensive DOM-scraping helpers
    messages.js           shared chrome.runtime message-type constants
    popup.js              popup UI logic
    supabaseClient.js      Supabase client wired to chrome.storage.local
    config.js              Supabase URL / anon key / Ascend app URL
  public/                static files copied as-is into dist/
    popup.html
    popup.css
  icons/                 16/48/128px PNG icons (+ generate_icons.py that made them)
  dist/                  build output — load THIS folder as the unpacked extension
```

Why a bundler at all: Manifest V3's content-security-policy won't allow
loading `@supabase/supabase-js` from a CDN (`script-src` is locked to
`'self'`), so it has to be bundled into the extension's own files.
[esbuild](https://esbuild.github.io/) was chosen for being fast and
essentially zero-config for this.

## Build

```bash
cd extension
npm install
npm run build
```

Output lands in `extension/dist/`. `npm run watch` rebuilds on file changes
if you're iterating (re-click the reload icon on the extension's card in
`chrome://extensions` after each rebuild — Chrome doesn't auto-reload
unpacked extensions).

## Load it in Chrome for testing

1. Run the build steps above so `extension/dist/` exists and is up to date.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the `extension/dist` folder (not `extension/` itself — pick the
   built output).
6. The Ascend icon should appear in the toolbar (you may need to click the
   puzzle-piece icon and pin it).

### Trying it end-to-end

1. Click the Ascend toolbar icon → log in with your Ascend account email and
   password.
2. Visit a LinkedIn job posting (a URL like
   `linkedin.com/jobs/view/<slug>-<id>`) or an Indeed job posting, then click
   the toolbar icon again.
   - If auto-detect worked, the Company/Role/Job description fields will be
     pre-filled with a note saying so — review them (auto-detect is
     best-effort) and edit anything that's wrong.
   - If the page isn't a job posting the extension recognizes, you'll see an
     empty form — fill it in by hand and save.
3. Click **Save to Ascend**. On success you'll see a confirmation with a
   **View in Ascend** button that opens your Roles tracker in a new tab.
4. **Log out** is available from the header once you're signed in.

### Re-testing after code changes

After editing anything in `extension/src/`, `extension/public/`, or
`extension/manifest.json`, run `npm run build` again, then go to
`chrome://extensions` and click the circular reload icon on the Ascend
extension's card (or toggle it off/on) to pick up the new `dist/` output.

## Known limitations

- **Selector fragility.** LinkedIn and Indeed change their markup without
  notice, and this build only had one live LinkedIn job page to verify
  selectors against (a signed-out "guest" view) — see the comments at the
  top of `src/content-linkedin.js` and `src/content-indeed.js` for exactly
  what was and wasn't confirmed live, and why. If auto-detect stops working
  after a site redesign, the fields will just come up blank — nothing
  crashes, but the selector lists in `src/content-linkedin.js` /
  `src/content-indeed.js` will need updating.
- **LinkedIn's "signed-in" markup was not independently verified.** The
  signed-out guest view (`topcard__*` / `show-more-less-html__markup`
  classes) was confirmed against a real, live LinkedIn job page. The
  signed-in "unified top card" class names
  (`job-details-jobs-unified-top-card__*`, `jobs-description__content`) are
  included as a fallback tier based on widely-documented current LinkedIn
  markup, but verifying them live would have required logging into a real
  LinkedIn account, which this build deliberately did not do.
- **Indeed markup was not verified live at all.** Fetching indeed.com from
  this build environment hit Cloudflare's bot-detection interstitial
  ("Just a moment...") — expected behavior for scripted/automated traffic,
  and not something a real user's browser session should hit, but it does
  mean the Indeed selectors in `src/content-indeed.js` are sourced from
  Indeed's commonly-documented current markup (`jobsearch-JobInfoHeader-title`,
  `#jobDescriptionText`, etc.) rather than confirmed against a live page in
  this session.
- **No end-to-end Supabase insert was run.** No persisted Supabase session
  was available in this environment, and creating a new account or resetting
  a password was out of scope. The insert code was verified structurally
  (column names, types, and defaults compared line-by-line against
  `addManualTrackerItem` in `src/features/tracker/hooks/useTracker.ts`) and
  the build/bundle output was verified, but a real logged-in save has not
  been exercised. Recommend doing one manual end-to-end test after loading
  the unpacked extension.
- **Extension icon.** `icons/icon16.png`, `icon48.png`, `icon128.png` are
  generated by `icons/generate_icons.py` (Pillow), adapting the checkmark/
  arrow glyph from `public/favicon.svg` into a flat two-tone (cyan + violet)
  PNG since a gradient doesn't stay crisp at 16px. Re-run that script if you
  want to tweak the mark.

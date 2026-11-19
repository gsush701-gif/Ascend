# Hosting the website on Cloudflare

The website (the React app built into `dist`) can be hosted on Cloudflare. The API in
`server/` is not part of this: it stays on Render.

`wrangler.jsonc` at the repo root tells Cloudflare what to publish (`dist`) and to answer
unknown addresses with `index.html`, which the app needs for routes such as `/jobs`.

## Build settings (Cloudflare dashboard)

| Setting | Value |
| --- | --- |
| Production branch | `AscendV1` |
| Root directory | empty |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch builds | off |

Add these as **build** variables (not runtime variables: Vite bakes `VITE_*` values into the
bundle while it builds):

- `NODE_VERSION` = `22`
- `VITE_API_URL` (the API address on Render)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Any of `VITE_CONTACT_EMAIL`, `VITE_GOVERNING_LAW`, `VITE_EXTENSION_STORE_URL`,
  `VITE_SENTRY_DSN` that are set on the Render static site.

Copy the values from the Render static site's Environment tab.

## Before pointing the domain here

1. Supabase, Authentication, URL Configuration: add the new address (`https://<name>.workers.dev/**`) to Redirect URLs.
2. Render API service: add the same address to `CORS_ORIGIN`, comma separated, and keep
   `https://ascendcareers.app` first (Stripe and email links use the first entry).
3. Test the new address: `/`, `/try`, `/internships`, a deep link such as `/jobs`, and Google sign-in.

## Switching the domain

1. Cloudflare DNS: delete the `@` and `www` CNAME records that point at `onrender.com`.
2. Worker, Settings, Domains and Routes: add `ascendcareers.app` and `www.ascendcareers.app`.
3. Optional: a Redirect Rule from `www` to `https://ascendcareers.app` (301).
4. Keep the Render static site for about a week as a fallback.

## Rolling back

Remove the two domains from the Worker and recreate the `@` and `www` CNAME records pointing
at `ascend-app-60ef.onrender.com`, DNS only.

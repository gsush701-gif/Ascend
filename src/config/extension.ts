/**
 * Where to add the Chrome extension from, once it's listed in the Chrome Web
 * Store. Set VITE_EXTENSION_STORE_URL on the frontend service (build time) when
 * the listing is live; until then the extension page offers the zip download
 * and manual install steps instead. Public by design, so safe to bake in.
 */
export const EXTENSION_STORE_URL: string | null =
  (import.meta.env.VITE_EXTENSION_STORE_URL as string | undefined)?.trim() || null;

/** The zip built by `npm run package` in extension/, served from public/. */
export const EXTENSION_ZIP_PATH = "/ascend-extension.zip";

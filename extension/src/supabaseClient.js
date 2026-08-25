// Supabase client for the extension, using chrome.storage.local as the auth
// session storage adapter instead of window.localStorage — content pages'
// localStorage isn't shared with the extension, and MV3 service workers
// don't have a `window` at all, so localStorage isn't an option here.
const { createClient } = require("@supabase/supabase-js");
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require("./config");

// Minimal storage adapter Supabase's GoTrue client expects: getItem,
// setItem, removeItem — each may return a Promise.
const chromeStorageAdapter = {
  getItem: async (key) => {
    const result = await chrome.storage.local.get(key);
    return Object.prototype.hasOwnProperty.call(result, key)
      ? result[key]
      : null;
  },
  setItem: async (key, value) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key) => {
    await chrome.storage.local.remove(key);
  },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: "ascend-extension-auth",
    autoRefreshToken: true,
    persistSession: true,
    // The popup is a transient DOM (Chrome tears it down on close), so
    // there's no long-lived page to receive a URL-based OAuth redirect.
    detectSessionInUrl: false,
  },
});

module.exports = { supabase };

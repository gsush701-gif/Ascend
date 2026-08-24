const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (!configured) {
  console.warn(
    "[supabaseAdmin] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — " +
      "auth verification and DB writes will be skipped.",
  );
}

const supabaseAdmin = configured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

module.exports = { supabaseAdmin, isSupabaseConfigured: configured };

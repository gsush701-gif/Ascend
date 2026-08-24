const { supabaseAdmin, isSupabaseConfigured } = require("../lib/supabaseAdmin");

/**
 * Attaches req.user when a valid Supabase access token is present.
 * Never blocks the request — AI endpoints stay usable logged-out;
 * persistence to the database is what requires req.user.
 */
async function optionalAuth(req, res, next) {
  req.user = null;

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token || !isSupabaseConfigured) {
    return next();
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user) {
      req.user = data.user;
    }
  } catch (e) {
    console.warn("[auth] token verification failed:", e.message);
  }

  next();
}

module.exports = { optionalAuth };

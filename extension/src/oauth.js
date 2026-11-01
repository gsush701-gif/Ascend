// Reads the result of "Continue with Google" out of the address the sign-in
// window ends on. After Google, Supabase sends the browser to our redirect URL
// (https://<extension id>.chromiumapp.org/) with the session in the fragment:
//   #access_token=...&refresh_token=...&expires_in=...
// or, if sign-in failed or was refused, an error in the fragment or query.
//
// Returns:
//   { accessToken, refreshToken }  on success
//   { error }                       when Supabase reported one (message is safe to show)
//   null                            when the address has neither
//
// Only ever called with the address chrome.identity hands back for our own
// redirect URL, and never logged, since it carries live tokens.

function readTokensFromRedirect(responseUrl) {
  let url;
  try {
    url = new URL(responseUrl);
  } catch (_err) {
    return null;
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const get = (name) => fragment.get(name) || query.get(name);

  const error = get("error_description") || get("error");
  if (error) return { error: String(error).replace(/\+/g, " ").slice(0, 200) };

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}

module.exports = { readTokensFromRedirect };

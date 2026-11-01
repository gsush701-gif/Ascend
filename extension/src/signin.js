// "Continue with Google" for the extension. Runs in its own browser tab
// (public/signin.html), not in the toolbar popup: Chrome closes a popup the
// moment another window opens, which would end the sign-in half way. A tab
// stays open for as long as Google takes.
//
// Flow: ask Supabase for the Google sign-in address, open it in Chrome's
// identity window, read the tokens off the address it finishes on, and store
// the session (chrome.storage.local, via the shared Supabase client). The user
// then just clicks the toolbar icon again, already signed in.
const { supabase } = require("./supabaseClient");
const { readTokensFromRedirect } = require("./oauth");

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const retryBtn = document.getElementById("retry");

function show(status, detail, { retry = false } = {}) {
  statusEl.textContent = status;
  detailEl.textContent = detail || "";
  retryBtn.classList.toggle("hidden", !retry);
}

async function run() {
  retryBtn.classList.add("hidden");
  show("Opening Google…", "A sign-in window will open. If you don't see it, check behind this tab.");
  try {
    const redirectTo = chrome.identity.getRedirectURL();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data || !data.url) {
      show("Couldn't start sign-in.", error ? error.message : "Please try again.", { retry: true });
      return;
    }

    const responseUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    const result = readTokensFromRedirect(responseUrl);
    if (!result || result.error) {
      show("Google sign-in didn't finish.", (result && result.error) || "Please try again.", { retry: true });
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    if (sessionError) {
      show("Signed in with Google, but couldn't save the session.", sessionError.message, { retry: true });
      return;
    }

    show("You're signed in.", "You can close this tab. Click the Ascend icon in your toolbar to save a job.");
  } catch (err) {
    // Closing the Google window early lands here.
    show("Sign-in was cancelled.", "Click the button to try again.", { retry: true });
    console.error("[ascend-extension] google sign-in failed:", err && err.message);
  }
}

retryBtn.addEventListener("click", run);
run();

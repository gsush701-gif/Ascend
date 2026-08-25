// Popup script: login form -> capture preview -> save to Ascend's `roles`
// table. Runs fresh every time the popup opens (Chrome tears the popup DOM
// down on close), so it always re-reads the persisted session from
// chrome.storage.local via the Supabase client rather than caching state.
const { supabase } = require("./supabaseClient");
const { ASCEND_APP_URL } = require("./config");
const { REQUEST_JOB } = require("./messages");

const views = {
  loading: document.getElementById("view-loading"),
  login: document.getElementById("view-login"),
  save: document.getElementById("view-save"),
  success: document.getElementById("view-success"),
};

const logoutBtn = document.getElementById("logout-btn");

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

const detectionNote = document.getElementById("detection-note");
const noDetectionNote = document.getElementById("no-detection-note");
const saveForm = document.getElementById("save-form");
const fieldCompany = document.getElementById("field-company");
const fieldRole = document.getElementById("field-role");
const fieldDescription = document.getElementById("field-description");
const saveError = document.getElementById("save-error");
const saveSubmit = document.getElementById("save-submit");

const viewInAscendBtn = document.getElementById("view-in-ascend-btn");
const saveAnotherBtn = document.getElementById("save-another-btn");

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].classList.toggle("hidden", key !== name);
  }
  logoutBtn.classList.toggle("hidden", name !== "save" && name !== "success");
}

function showBanner(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideBanner(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

async function init() {
  showView("loading");
  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data && data.session;
  } catch (err) {
    console.error("[ascend-extension] getSession failed:", err);
  }

  if (session && session.user) {
    await enterSaveView();
  } else {
    showView("login");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanner(loginError);

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    showBanner(loginError, "Enter your email and password.");
    return;
  }

  loginSubmit.disabled = true;
  loginSubmit.textContent = "Logging in…";
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showBanner(loginError, error.message || "Could not log in.");
      return;
    }
    loginPassword.value = "";
    await enterSaveView();
  } catch (err) {
    showBanner(loginError, "Network error. Please try again.");
    console.error("[ascend-extension] sign in failed:", err);
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Log in";
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[ascend-extension] sign out failed:", err);
  }
  showView("login");
});

async function enterSaveView() {
  showView("save");
  resetSaveForm();

  const captured = await captureFromActiveTab();
  if (captured && captured.detected) {
    fieldCompany.value = captured.company || "";
    fieldRole.value = captured.title || "";
    fieldDescription.value = captured.description || "";
    showBanner(
      detectionNote,
      `Auto-detected from ${captured.source}. Review and edit before saving.`,
    );
    noDetectionNote.classList.add("hidden");
  } else if (captured && captured.attempted) {
    // Content script ran on a matched job-board page but couldn't find
    // usable fields (markup changed / page hasn't finished rendering).
    noDetectionNote.classList.remove("hidden");
    hideBanner(detectionNote);
  } else {
    // Not a LinkedIn/Indeed job page at all — plain manual entry, no notes.
    noDetectionNote.classList.add("hidden");
    hideBanner(detectionNote);
  }
}

function resetSaveForm() {
  saveForm.reset();
  hideBanner(saveError);
  hideBanner(detectionNote);
  noDetectionNote.classList.add("hidden");
}

/**
 * Asks the active tab's content script (if any) what it auto-detected.
 * Returns null when the tab isn't a supported job-board page or has no
 * content script loaded — the popup treats that as "use manual entry",
 * never as an error.
 */
async function captureFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) return null;

    let source = null;
    if (/(^|\.)linkedin\.com\/jobs\//.test(tab.url.replace(/^https?:\/\//, ""))) {
      source = "LinkedIn";
    } else if (/(^|\.)indeed\.com\//.test(tab.url.replace(/^https?:\/\//, ""))) {
      source = "Indeed";
    } else {
      return null;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: REQUEST_JOB });
    if (!response) return { attempted: true, detected: false };
    return { ...response, source, attempted: true };
  } catch (_err) {
    // No content script listening (page not fully loaded yet, or this
    // build's manifest match patterns don't cover this exact URL shape).
    return null;
  }
}

saveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanner(saveError);

  const company = fieldCompany.value.trim();
  const role = fieldRole.value.trim();
  const jobDescription = fieldDescription.value.trim();

  if (!company || !role) {
    showBanner(saveError, "Company and role are required.");
    return;
  }

  saveSubmit.disabled = true;
  saveSubmit.textContent = "Saving…";
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      showView("login");
      return;
    }

    // Mirrors src/features/tracker/hooks/useTracker.ts's addManualTrackerItem:
    // client-generated id, status defaults to "Wishlist", alignment 0 for a
    // manually-added role (no analyzer report attached), next_step is a
    // short human-entered string, timestamps set client-side.
    const now = new Date().toISOString();
    const { error } = await supabase.from("roles").insert({
      id: crypto.randomUUID(),
      user_id: session.user.id,
      company,
      role,
      status: "Wishlist",
      alignment: 0,
      next_step: "Apply",
      job_description: jobDescription || null,
      notes: null,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      showBanner(saveError, error.message || "Could not save. Please try again.");
      return;
    }

    showView("success");
  } catch (err) {
    showBanner(saveError, "Network error. Please try again.");
    console.error("[ascend-extension] insert failed:", err);
  } finally {
    saveSubmit.disabled = false;
    saveSubmit.textContent = "Save to Ascend";
  }
});

viewInAscendBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${ASCEND_APP_URL}/roles` });
});

saveAnotherBtn.addEventListener("click", () => {
  enterSaveView();
});

init();

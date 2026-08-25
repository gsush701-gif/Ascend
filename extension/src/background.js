// Background service worker (Manifest V3). Kept deliberately thin: its only
// job is to reflect job-detection state on the toolbar badge. All auth and
// database work happens in the popup, which is a short-lived context that
// can safely construct its own Supabase client per open — this avoids
// relying on setTimeout-based token-refresh timers surviving an MV3 service
// worker being suspended and woken back up, which is not guaranteed.
const { JOB_DETECTED } = require("./messages");

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#22d3ee" });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === JOB_DETECTED && sender.tab && sender.tab.id != null) {
    const detected = Boolean(message.payload && message.payload.detected);
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: detected ? "1" : "",
    });
  }
});

// Shared message-type constants for background <-> content script <-> popup
// communication (chrome.runtime.sendMessage / chrome.tabs.sendMessage).
module.exports = {
  // Content script -> background: fired once on page load with whatever it
  // managed to auto-detect, so background can set an action badge.
  JOB_DETECTED: "ASCEND_JOB_DETECTED",
  // Popup -> content script: "extract again right now and tell me what you
  // found" (re-extracts fresh rather than relying on a stale JOB_DETECTED
  // payload, in case the SPA re-rendered since page load).
  REQUEST_JOB: "ASCEND_REQUEST_JOB",
};

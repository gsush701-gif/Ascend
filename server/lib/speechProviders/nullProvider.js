// The only concrete server-side speech provider shipped today — see
// ./types.js for the interface this implements (and that any real provider
// added later must implement too). Deliberately does nothing: no HTTP call,
// no fixture transcript. There is no route in server/index.js that calls
// this today — the working transcription path for the voice interview
// feature is entirely client-side (see ./types.js's header comment). This
// module exists purely as the documented, ready-to-implement extension
// point for a future paid provider, matching
// server/lib/jobProviders/nullProvider.js's shape for consistency.

/** @type {import('./types').SpeechProvider} */
const NullSpeechProvider = {
  isConfigured: false,

  // Never throws, never fabricates a transcript — always resolves to an
  // empty, clearly-flagged result.
  async transcribe(_params = {}) {
    return {
      text: "",
      providerConfigured: false,
    };
  },
};

module.exports = { NullSpeechProvider };

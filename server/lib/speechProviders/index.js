// Active server-side speech provider selection (Phase 7 Task 12), mirroring
// server/lib/jobProviders/index.js's exact shape and env-var-driven
// selection pattern.
//
// IMPORTANT: nothing in server/index.js calls this today. The voice
// interview feature's actual transcription happens entirely in the browser
// via the Web Speech API (see ./types.js's header comment and
// src/features/voiceInterview/useSpeechRecognition.ts) — genuinely working
// today in Chrome/Edge, with no server round-trip and no cost. This module
// exists only as the pre-built extension point for a future paid provider
// (needed for broader browser support, e.g. Firefox/Safari), so that adding
// one later is additive:
//   1. Add server/lib/speechProviders/<name>Provider.js implementing the
//      SpeechProvider contract in ./types.js (isConfigured + async
//      transcribe()).
//   2. require() it below and add a matching case in selectProvider().
//   3. Add a POST /api/speech-transcribe route in server/index.js that
//      accepts an audio blob and calls activeSpeechProvider.transcribe()
//      (see ./types.js for the shape a real route would need).
//   4. Set SPEECH_PROVIDER=<name> (plus whatever API key that provider
//      needs) in the environment.

const { NullSpeechProvider } = require("./nullProvider");

const SPEECH_PROVIDER = (process.env.SPEECH_PROVIDER || "none").trim().toLowerCase();

function selectProvider(name) {
  switch (name) {
    case "none":
      return NullSpeechProvider;
    default:
      console.warn(
        `[speechProviders] Unknown SPEECH_PROVIDER "${name}" — falling back to NullSpeechProvider (browser-native Web Speech API remains the only working transcription path).`,
      );
      return NullSpeechProvider;
  }
}

const activeSpeechProvider = selectProvider(SPEECH_PROVIDER);
const isSpeechProviderConfigured = Boolean(activeSpeechProvider.isConfigured);

module.exports = { activeSpeechProvider, isSpeechProviderConfigured, SPEECH_PROVIDER };

// Speech-to-text provider contract (Phase 7 Task 12 — Voice interview
// architecture).
//
// Unlike server/lib/jobProviders/ (which backs a real route today, just with
// no real data yet), speech-to-text for the voice interview feature is
// implemented entirely client-side: src/features/voiceInterview's
// useSpeechRecognition hook wraps the browser's own
// window.SpeechRecognition / window.webkitSpeechRecognition (the Web Speech
// API), which transcribes audio to text inside the browser and never sends
// audio to this server at all. That's genuinely functional today in Chrome,
// Edge, and other Chromium-based browsers — it is not a stub.
//
// The gap this file documents: Firefox and Safari don't support the Web
// Speech API well (Safari: limited/inconsistent; Firefox: unsupported as of
// this writing). Closing that gap requires a real, paid speech-to-text
// provider (e.g. Whisper API, Google Speech-to-Text, Deepgram) that this
// project has no account/budget for yet. This file exists so that when one
// is added later, the integration point is a single new file implementing
// the interface below, plus one new server route, not a rewrite of the
// voice interview flow.
//
// A future server-mediated provider would need:
//   1. A new route (e.g. POST /api/speech-transcribe) accepting an audio
//      blob (multipart or base64) + mimeType, auth'd the same way the
//      existing AI routes are (optionalAuth + aiLimiter + enforceUsageQuota
//      — see POST /api/interview-feedback in server/index.js for the
//      pattern to copy).
//   2. The frontend's useSpeechRecognition hook (or a sibling hook) to
//      record audio (MediaRecorder) instead of relying on the browser's
//      built-in recognizer, and POST the resulting blob to that route
//      instead of reading `event.results` locally.
//   3. A provider module here (e.g. whisperProvider.js) implementing
//      `SpeechProvider` below, selected the same "env var picks the
//      provider" way as server/lib/jobProviders/index.js.
//
// This codebase is mostly-plain-JS on the server (see server/lib/scoring.js,
// server/lib/stripe.js, server/lib/jobProviders/), so — matching
// server/lib/jobProviders/types.js — the contract here is documented as
// JSDoc typedefs rather than a TypeScript interface; nothing here needs
// runtime enforcement beyond what server/lib/speechProviders/nullProvider.js
// already demonstrates by example.
//
// @typedef {Object} SpeechTranscribeParams
// @property {Buffer} audio - raw audio bytes
// @property {string} mimeType - e.g. "audio/webm", "audio/wav"
// @property {string} [languageHint] - BCP-47 tag, e.g. "en-US"
//
// @typedef {Object} SpeechTranscribeResult
// @property {string} text - transcribed text; "" when nothing could be transcribed
// @property {boolean} providerConfigured - false when no real server-side
//   provider is wired in; callers must render this as "not available", never
//   fabricate a transcript.
//
// @typedef {Object} SpeechProvider
// @property {boolean} isConfigured
// @property {(params: SpeechTranscribeParams) => Promise<SpeechTranscribeResult>} transcribe

module.exports = {};

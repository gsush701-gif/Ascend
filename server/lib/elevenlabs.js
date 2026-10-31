// ElevenLabs text-to-speech (Week 2 voice interview upgrade) — gives the
// mock interviewer a real spoken voice. Mirrors server/lib/groq.js's
// config/error-handling shape (isConfigured flag + a NotConfiguredError /
// RequestError pair) so it plugs into the same route patterns already used
// for every other AI feature in server/index.js.
//
// Deliberately TTS-only: the interviewee's side of the conversation stays
// on the browser's free, already-working Web Speech API
// (src/features/voiceInterview/useSpeechRecognition.ts) — no reason to add
// cost/complexity transcribing audio server-side when that already works.

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// ElevenLabs' stock "Charlie" voice — casual/conversational tone. Note:
// ElevenLabs' free tier can only use its own default/premade voices via the
// API — community "voice library" voices (e.g. ones picked from
// elevenlabs.io/app/voice-library) return 402 Payment Required on a free
// account, even though they work fine in the ElevenLabs web app itself.
// Override with any other premade voice_id, or a library voice_id once on a
// paid ElevenLabs plan.
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "IKne3meq5aSn9XLyUdCD";
// eleven_multilingual_v2 is ElevenLabs' higher-quality, more natural model.
// The earlier default, eleven_turbo_v2_5, is faster and uses roughly half
// the credits per character, but sounded flat/robotic for a mock-interview
// voice — set ELEVENLABS_MODEL_ID=eleven_turbo_v2_5 to go back to it if
// credits matter more than naturalness. See elevenlabs.io/docs/models.
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

// Delivery settings (all 0-1). Lower stability = more varied, expressive
// delivery (less monotone); style adds some emphasis/emotion. These defaults
// are the "B" sample that was picked by ear over the plain model defaults.
// Each can be tuned without a code change via the matching env var.
const VOICE_SETTINGS = {
  stability: numberFromEnv("ELEVENLABS_STABILITY", 0.35),
  similarity_boost: numberFromEnv("ELEVENLABS_SIMILARITY", 0.75),
  style: numberFromEnv("ELEVENLABS_STYLE", 0.25),
  use_speaker_boost: true,
};

const configured = Boolean(ELEVENLABS_API_KEY);

if (!configured) {
  console.warn(
    "[elevenlabs] ELEVENLABS_API_KEY not set — the voice interview's spoken " +
      "interviewer will be unavailable until it's configured (frontend falls " +
      "back to the browser's built-in speechSynthesis voice).",
  );
}

class ElevenLabsNotConfiguredError extends Error {
  constructor() {
    super("ElevenLabs API key is not configured on the server.");
    this.name = "ElevenLabsNotConfiguredError";
    this.statusCode = 503;
  }
}

class ElevenLabsRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ElevenLabsRequestError";
    this.statusCode = 502;
  }
}

/**
 * Synthesize speech for one short line of text (an interview question, or
 * the session's static intro line). Returns the raw mp3 audio as a Buffer.
 */
async function synthesizeSpeech(text) {
  if (!configured) throw new ElevenLabsNotConfiguredError();

  let response;
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: VOICE_SETTINGS,
        }),
      },
    );
  } catch (e) {
    throw new ElevenLabsRequestError(e.message || "ElevenLabs request failed");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ElevenLabsRequestError(
      `ElevenLabs request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  synthesizeSpeech,
  isElevenLabsConfigured: configured,
  ELEVENLABS_MODEL_ID,
  ElevenLabsNotConfiguredError,
  ElevenLabsRequestError,
};

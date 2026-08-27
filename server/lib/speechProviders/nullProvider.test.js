import { describe, it, expect } from "vitest";
import { NullSpeechProvider } from "./nullProvider.js";

describe("NullSpeechProvider", () => {
  it("is flagged as not configured", () => {
    expect(NullSpeechProvider.isConfigured).toBe(false);
  });

  it("transcribe() always resolves to an empty, clearly-flagged result", async () => {
    const result = await NullSpeechProvider.transcribe({
      audio: Buffer.from("fake"),
      mimeType: "audio/webm",
    });
    expect(result.text).toBe("");
    expect(result.providerConfigured).toBe(false);
  });

  it("never throws, even with no params at all", async () => {
    await expect(NullSpeechProvider.transcribe()).resolves.toBeDefined();
    await expect(NullSpeechProvider.transcribe(undefined)).resolves.toBeDefined();
  });
});

describe("speech provider selection (server/lib/speechProviders/index.js)", () => {
  it("defaults to the NullSpeechProvider and reports providerConfigured: false", async () => {
    // index.js reads SPEECH_PROVIDER once at require-time (matching
    // server/lib/jobProviders/index.js), and no test in this suite sets
    // SPEECH_PROVIDER, so importing it here exercises the real default
    // ("none") path.
    const mod = await import("./index.js");
    expect(mod.isSpeechProviderConfigured).toBe(false);
    expect(mod.activeSpeechProvider.isConfigured).toBe(false);
    const result = await mod.activeSpeechProvider.transcribe({});
    expect(result.providerConfigured).toBe(false);
    expect(mod.SPEECH_PROVIDER).toBe("none");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

const VALID_KEY_HEX = "0123456789abcdef".repeat(4); // 64 hex chars = 32 bytes

// github.js does a plain CommonJS `require("./tokenCrypto")` internally.
// `vi.resetModules()` clears Vitest's own ESM module graph, but a nested
// CJS require resolved through Node's native module system keeps its own
// process-wide require.cache entry — so without also evicting it here,
// tokenCrypto.js's env-derived `isTokenCryptoConfigured` would stay frozen
// at whatever it was the first time any test imported it, regardless of
// env var changes in later tests. Evicting both from Node's real require
// cache (not just Vitest's) makes each test's dynamic import() genuinely
// fresh, matching how these modules actually behave in production (loaded
// exactly once, from whatever the real env is at boot).
const nodeRequire = createRequire(import.meta.url);
function resetGithubModules() {
  vi.resetModules();
  for (const mod of ["./github.js", "./tokenCrypto.js"]) {
    try {
      delete nodeRequire.cache[nodeRequire.resolve(mod)];
    } catch {
      // not yet loaded — nothing to evict
    }
  }
}

describe("github — not configured (env vars absent)", () => {
  beforeEach(() => {
    resetGithubModules();
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_REDIRECT_URI;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("reports isGithubConfigured as false with none of the four vars set", async () => {
    const { isGithubConfigured } = await import("./github.js");
    expect(isGithubConfigured).toBe(false);
  });

  it("stays not-configured if the GitHub client id/secret/redirect are set but not the encryption key", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    process.env.GITHUB_REDIRECT_URI = "https://example.com/api/github/callback";
    const { isGithubConfigured } = await import("./github.js");
    expect(isGithubConfigured).toBe(false);
  });

  it("stays not-configured if only TOKEN_ENCRYPTION_KEY is set", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY_HEX;
    const { isGithubConfigured } = await import("./github.js");
    expect(isGithubConfigured).toBe(false);
  });

  it("stays not-configured if the redirect URI alone is missing", async () => {
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY_HEX;
    const { isGithubConfigured } = await import("./github.js");
    expect(isGithubConfigured).toBe(false);
  });

  it("verifyState fails closed when the state secret isn't configured", async () => {
    const { verifyState } = await import("./github.js");
    const result = verifyState("anything.at-all");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_configured");
  });
});

describe("github — configured", () => {
  beforeEach(() => {
    resetGithubModules();
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    process.env.GITHUB_REDIRECT_URI = "https://example.com/api/github/callback";
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY_HEX;
  });

  afterEach(() => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_REDIRECT_URI;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  it("reports isGithubConfigured as true when all four vars are present", async () => {
    const { isGithubConfigured } = await import("./github.js");
    expect(isGithubConfigured).toBe(true);
  });

  it("getRedirectUri returns the configured redirect URI", async () => {
    const { getRedirectUri } = await import("./github.js");
    expect(getRedirectUri()).toBe("https://example.com/api/github/callback");
  });

  it("buildScope requests only public_repo unless includePrivate is explicitly true", async () => {
    const { buildScope } = await import("./github.js");
    expect(buildScope(false)).toBe("read:user,public_repo");
    expect(buildScope(undefined)).toBe("read:user,public_repo");
    expect(buildScope(true)).toBe("read:user,repo");
  });

  it("buildAuthorizeUrl includes client_id, redirect_uri, scope, and state", async () => {
    const { buildAuthorizeUrl, generateState } = await import("./github.js");
    const state = generateState("user-123");
    const url = buildAuthorizeUrl({ state, redirectUri: "https://example.com/api/github/callback", includePrivate: false });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/api/github/callback");
    expect(parsed.searchParams.get("scope")).toBe("read:user,public_repo");
    expect(parsed.searchParams.get("state")).toBe(state);
  });

  // --- CSRF state: generation + verification round trip ---

  describe("generateState / verifyState", () => {
    it("round-trips: a freshly generated state verifies as valid for the same user", async () => {
      const { generateState, verifyState } = await import("./github.js");
      const state = generateState("user-abc-123");
      const result = verifyState(state);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user-abc-123");
    });

    it("two states for the same user are different (random nonce)", async () => {
      const { generateState } = await import("./github.js");
      const a = generateState("user-1");
      const b = generateState("user-1");
      expect(a).not.toBe(b);
    });

    it("rejects a missing or empty state", async () => {
      const { verifyState } = await import("./github.js");
      expect(verifyState(undefined).valid).toBe(false);
      expect(verifyState("").valid).toBe(false);
      expect(verifyState(null).valid).toBe(false);
    });

    it("rejects a malformed state with no signature separator", async () => {
      const { verifyState } = await import("./github.js");
      const result = verifyState("not-a-real-state-token");
      expect(result.valid).toBe(false);
    });

    it("rejects a state with a tampered payload (uid substitution) — the core CSRF guarantee", async () => {
      const { generateState, verifyState } = await import("./github.js");
      const state = generateState("victim-user-id");
      const dotIndex = state.lastIndexOf(".");
      const payloadB64 = state.slice(0, dotIndex);
      const sig = state.slice(dotIndex + 1);

      // Attacker decodes the payload, swaps in their own uid, re-encodes —
      // but can't produce a valid signature without the server's secret.
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      payload.uid = "attacker-user-id";
      const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const forgedState = `${forgedPayloadB64}.${sig}`;

      const result = verifyState(forgedState);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("bad_signature");
    });

    it("rejects a state with a tampered/garbage signature", async () => {
      const { generateState, verifyState } = await import("./github.js");
      const state = generateState("user-xyz");
      const dotIndex = state.lastIndexOf(".");
      const tampered = `${state.slice(0, dotIndex)}.${"a".repeat(20)}`;
      const result = verifyState(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("bad_signature");
    });

    it("rejects an expired state", async () => {
      vi.useFakeTimers();
      const { generateState, verifyState } = await import("./github.js");
      const state = generateState("user-expiry-test");
      vi.advanceTimersByTime(11 * 60 * 1000); // past the 10-minute TTL
      const result = verifyState(state);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
      vi.useRealTimers();
    });

    it("rejects a state signed under a different secret (e.g. after a key rotation)", async () => {
      const { generateState } = await import("./github.js");
      const state = generateState("user-rotate-test");

      resetGithubModules();
      process.env.TOKEN_ENCRYPTION_KEY = "f".repeat(64); // different valid key
      const { verifyState } = await import("./github.js");
      const result = verifyState(state);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("bad_signature");
    });

    it("never throws on garbage input", async () => {
      const { verifyState } = await import("./github.js");
      expect(() => verifyState("....")).not.toThrow();
      expect(() => verifyState("a.b.c")).not.toThrow();
      expect(() => verifyState(123)).not.toThrow();
      expect(() => verifyState({})).not.toThrow();
    });
  });

  // --- GitHub API calls: verified via mocked fetch, no live network I/O ---

  describe("exchangeCodeForToken", () => {
    it("returns the access token and scope on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "gho_abc123", scope: "read:user,public_repo", token_type: "bearer" }),
      });
      const { exchangeCodeForToken } = await import("./github.js");
      const result = await exchangeCodeForToken("some-code", "https://example.com/callback");
      expect(result).toEqual({ accessToken: "gho_abc123", scope: "read:user,public_repo" });
    });

    it("throws when GitHub returns an error body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }),
      });
      const { exchangeCodeForToken } = await import("./github.js");
      await expect(exchangeCodeForToken("bad-code", "https://example.com/callback")).rejects.toThrow(
        "The code passed is incorrect or expired.",
      );
    });

    it("throws when the HTTP response itself is not ok", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({}) });
      const { exchangeCodeForToken } = await import("./github.js");
      await expect(exchangeCodeForToken("code", "https://example.com/callback")).rejects.toThrow();
    });
  });

  describe("fetchGithubUser / fetchGithubRepos", () => {
    it("fetchGithubUser returns login and id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ login: "octocat", id: 583231 }),
      });
      const { fetchGithubUser } = await import("./github.js");
      const result = await fetchGithubUser("token");
      expect(result).toEqual({ login: "octocat", id: 583231 });
    });

    it("fetchGithubRepos maps GitHub's repo shape into the app's camelCase shape", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: "cool-project",
            full_name: "octocat/cool-project",
            description: "A cool project",
            language: "TypeScript",
            topics: ["react", "vite"],
            private: false,
            pushed_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
      const { fetchGithubRepos } = await import("./github.js");
      const repos = await fetchGithubRepos("token");
      expect(repos).toEqual([
        {
          githubRepoId: 1,
          name: "cool-project",
          fullName: "octocat/cool-project",
          description: "A cool project",
          languages: { TypeScript: true },
          topics: ["react", "vite"],
          isPrivate: false,
          pushedAt: "2026-01-01T00:00:00Z",
        },
      ]);
    });

    it("fetchGithubRepos never fabricates a repo when GitHub returns something unexpected", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ not: "an array" }) });
      const { fetchGithubRepos } = await import("./github.js");
      const repos = await fetchGithubRepos("token");
      expect(repos).toEqual([]);
    });

    it("throws on a non-ok GitHub API response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401, text: async () => "Bad credentials" });
      const { fetchGithubUser } = await import("./github.js");
      await expect(fetchGithubUser("bad-token")).rejects.toThrow(/401/);
    });
  });
});

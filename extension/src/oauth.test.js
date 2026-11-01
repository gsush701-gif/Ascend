import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { readTokensFromRedirect } = require("./oauth");

const BASE = "https://abcdefghijklmnop.chromiumapp.org/";

describe("readTokensFromRedirect", () => {
  it("reads the session tokens from the fragment", () => {
    expect(readTokensFromRedirect(`${BASE}#access_token=aaa.bbb.ccc&refresh_token=r123&expires_in=3600&token_type=bearer`)).toEqual({
      accessToken: "aaa.bbb.ccc",
      refreshToken: "r123",
    });
  });

  it("reports an error from the fragment or the query, with plus signs turned into spaces", () => {
    expect(readTokensFromRedirect(`${BASE}#error=access_denied&error_description=User+denied+access`)).toEqual({
      error: "User denied access",
    });
    expect(readTokensFromRedirect(`${BASE}?error=server_error`)).toEqual({ error: "server_error" });
  });

  it("returns null when there is nothing usable, and never throws on junk", () => {
    expect(readTokensFromRedirect(BASE)).toBeNull();
    expect(readTokensFromRedirect(`${BASE}#access_token=only-one`)).toBeNull();
    expect(readTokensFromRedirect("not a url")).toBeNull();
    expect(readTokensFromRedirect(undefined)).toBeNull();
  });

  it("caps the length of an error message it will show", () => {
    const long = "x".repeat(500);
    expect(readTokensFromRedirect(`${BASE}#error_description=${long}`).error).toHaveLength(200);
  });
});

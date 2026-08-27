import { describe, it, expect } from "vitest";
import {
  slugify,
  validateSlugFormat,
  normalizeAndValidateSlug,
  generateDefaultSlug,
  generateRandomSlug,
  extractEmailLocalPart,
} from "./publicProfileSlug";

describe("slugify", () => {
  it("lowercases and replaces disallowed characters with hyphens", () => {
    expect(slugify("Sushil Gautam!")).toBe("sushil-gautam");
  });

  it("collapses repeated separators into a single hyphen", () => {
    expect(slugify("a__b   c")).toBe("a-b-c");
  });

  it("trims leading/trailing hyphens produced by leading/trailing junk", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("!!!wow!!!")).toBe("wow");
  });

  it("leaves an already-clean slug untouched", () => {
    expect(slugify("sushil-g")).toBe("sushil-g");
  });

  it("preserves existing digits", () => {
    expect(slugify("user2026")).toBe("user2026");
  });
});

describe("validateSlugFormat", () => {
  it("accepts a well-formed slug", () => {
    expect(validateSlugFormat("sushil-g")).toEqual({ valid: true });
  });

  it("rejects an empty string", () => {
    const result = validateSlugFormat("");
    expect(result.valid).toBe(false);
  });

  it("rejects a slug shorter than 3 characters", () => {
    const result = validateSlugFormat("ab");
    expect(result.valid).toBe(false);
  });

  it("rejects a slug longer than 40 characters", () => {
    const result = validateSlugFormat("a".repeat(41));
    expect(result.valid).toBe(false);
  });

  it("accepts exactly 40 characters", () => {
    expect(validateSlugFormat("a".repeat(40))).toEqual({ valid: true });
  });

  it("rejects uppercase letters", () => {
    expect(validateSlugFormat("Sushil").valid).toBe(false);
  });

  it("rejects underscores and other symbols", () => {
    expect(validateSlugFormat("sushil_g").valid).toBe(false);
    expect(validateSlugFormat("sushil@g").valid).toBe(false);
  });

  it("rejects leading or trailing hyphens", () => {
    expect(validateSlugFormat("-sushil").valid).toBe(false);
    expect(validateSlugFormat("sushil-").valid).toBe(false);
  });

  it("rejects doubled hyphens", () => {
    expect(validateSlugFormat("sushil--g").valid).toBe(false);
  });

  it("accepts numbers-only and single-hyphen-joined multi-word slugs", () => {
    expect(validateSlugFormat("2026").valid).toBe(true);
    expect(validateSlugFormat("sushil-g-2026").valid).toBe(true);
  });
});

describe("normalizeAndValidateSlug", () => {
  it("normalizes raw user input and reports validity of the normalized result", () => {
    const result = normalizeAndValidateSlug("Sushil G!");
    expect(result.slug).toBe("sushil-g");
    expect(result.valid).toBe(true);
  });

  it("reports invalid when normalization collapses to something too short", () => {
    const result = normalizeAndValidateSlug("!!");
    expect(result.slug).toBe("");
    expect(result.valid).toBe(false);
  });
});

describe("generateDefaultSlug", () => {
  it("derives from the seed and always appends a random suffix", () => {
    const slug = generateDefaultSlug("Sushil Gautam");
    expect(slug.startsWith("sushil-gautam-")).toBe(true);
    expect(validateSlugFormat(slug).valid).toBe(true);
  });

  it("falls back to 'user' when the seed slugifies to nothing", () => {
    const slug = generateDefaultSlug("!!!");
    expect(slug.startsWith("user-")).toBe(true);
  });

  it("always returns a valid slug even for a very long seed", () => {
    const slug = generateDefaultSlug("a".repeat(100));
    expect(validateSlugFormat(slug).valid).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("produces different suffixes across calls (probabilistically)", () => {
    const a = generateDefaultSlug("sushil");
    const b = generateDefaultSlug("sushil");
    // Not a hard guarantee, but collision odds are astronomically low for
    // a 4-char base-36 suffix run twice in a unit test.
    expect(a).not.toBe(b);
  });
});

describe("generateRandomSlug", () => {
  it("always returns a valid slug with no seed dependency", () => {
    const slug = generateRandomSlug();
    expect(validateSlugFormat(slug).valid).toBe(true);
    expect(slug.startsWith("profile-")).toBe(true);
  });

  it("produces different values across calls (probabilistically)", () => {
    expect(generateRandomSlug()).not.toBe(generateRandomSlug());
  });
});

describe("extractEmailLocalPart", () => {
  it("returns the part before @", () => {
    expect(extractEmailLocalPart("sushil@example.com")).toBe("sushil");
  });

  it("returns the whole string when there's no @", () => {
    expect(extractEmailLocalPart("notanemail")).toBe("notanemail");
  });
});

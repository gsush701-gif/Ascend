import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateTailoredBullets, numbersIn, placeholdersIn } = require("./tailorBullets");

const RESUME = `Jordan Rivera
EXPERIENCE
Software Engineering Intern, Example Corp
• Built internal tools using Python and React for the support team
• Improved test coverage by 30 percent across 4 services
PROJECTS
• Made a portfolio website with Node and deployed it to Render`;

const good = {
  original: "Built internal tools using Python and React for the support team",
  rewritten: "Built internal support tools in Python and React that [add result: e.g. time saved or tickets handled]",
  why: "The posting asks for Python and React.",
};

describe("validateTailoredBullets", () => {
  it("keeps a faithful rewrite and reads its blanks from the brackets", () => {
    const [b] = validateTailoredBullets({ bullets: [good] }, RESUME);
    expect(b.original).toBe(good.original);
    expect(b.needs).toEqual(["add result: e.g. time saved or tickets handled"]);
    expect(b.why).toContain("Python");
  });

  it("drops a rewrite that quotes a line that is not on the resume", () => {
    const fake = { ...good, original: "Led a team of 12 engineers to ship the payments platform" };
    expect(validateTailoredBullets({ bullets: [fake] }, RESUME)).toEqual([]);
  });

  it("drops a rewrite that invents a number", () => {
    const invented = { ...good, rewritten: "Built internal support tools in Python and React, cutting handle time by 40%" };
    expect(validateTailoredBullets({ bullets: [invented] }, RESUME)).toEqual([]);
  });

  it("allows numbers that were in the original, and ignores digits inside blanks", () => {
    const original = "Improved test coverage by 30 percent across 4 services";
    const kept = validateTailoredBullets(
      {
        bullets: [
          {
            original,
            rewritten: "Raised test coverage by 30 percent across 4 services, catching [add: e.g. 5 bugs] before release",
            why: "Shows testing.",
          },
        ],
      },
      RESUME,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].needs).toEqual(["add: e.g. 5 bugs"]);
  });

  it("drops unchanged, too short, and duplicate suggestions, and caps the list", () => {
    const same = { ...good, rewritten: good.original };
    const short = { ...good, rewritten: "Built tools" };
    expect(validateTailoredBullets({ bullets: [same, short] }, RESUME)).toEqual([]);
    expect(validateTailoredBullets({ bullets: [good, good] }, RESUME)).toHaveLength(1);

    const lines = Array.from({ length: 8 }, (_, i) => `Wrote feature number ${i} for the project`);
    const resume = lines.join("\n");
    const many = lines.map((l) => ({ original: l, rewritten: `${l} using [add the tool you used]` }));
    expect(validateTailoredBullets({ bullets: many }, resume)).toHaveLength(5);
  });

  it("treats number words like digits: 'four' matches '4', but an invented 'half' or 'three' is dropped", () => {
    const original = "Improved test coverage by 30 percent across 4 services";
    const ok = { original, rewritten: "Raised test coverage by 30 percent across four services, catching [add: bugs found]", why: "x" };
    const half = { original, rewritten: "Improved test coverage by 30 percent across 4 services and halved flaky tests, [add: how]", why: "x" };
    const doubled = { original, rewritten: "Doubled test coverage by 30 percent across 4 services [add result]", why: "x" };
    const three = { original: "Built internal tools using Python and React for the support team", rewritten: "Built three internal tools in Python and React [add result]", why: "x" };
    expect(validateTailoredBullets({ bullets: [ok] }, RESUME)).toHaveLength(1);
    expect(validateTailoredBullets({ bullets: [doubled] }, RESUME)).toEqual([]);
    expect(validateTailoredBullets({ bullets: [three] }, RESUME)).toEqual([]);
    expect(validateTailoredBullets({ bullets: [half] }, RESUME)).toEqual([]);
  });

  it("drops a rewrite that talks the student up ('helped' becomes 'led')", () => {
    const resume = "- Helped with testing and fixed bugs in the billing service";
    const up = { original: "Helped with testing and fixed bugs in the billing service", rewritten: "Led testing and fixed bugs in the billing service [add the tool you used]", why: "x" };
    const same = { original: "Helped with testing and fixed bugs in the billing service", rewritten: "Helped test the billing service [add the tool you used] and fixed bugs in it", why: "x" };
    expect(validateTailoredBullets({ bullets: [up] }, resume)).toEqual([]);
    expect(validateTailoredBullets({ bullets: [same] }, resume)).toHaveLength(1);
  });

  it("allows an ownership verb that the original already used", () => {
    const resume = "- Led a team of 3 students building a mobile app";
    const b = { original: "Led a team of 3 students building a mobile app", rewritten: "Led a team of 3 students building a mobile app in [add the framework you used]", why: "x" };
    expect(validateTailoredBullets({ bullets: [b] }, resume)).toHaveLength(1);
  });

  it("tolerates a leading bullet mark and different quote styles in the original", () => {
    const withMark = { ...good, original: "• Built internal tools using Python and React for the support team" };
    expect(validateTailoredBullets({ bullets: [withMark] }, RESUME)).toHaveLength(1);
  });

  it("returns nothing for malformed model output", () => {
    expect(validateTailoredBullets(null, RESUME)).toEqual([]);
    expect(validateTailoredBullets({ bullets: "nope" }, RESUME)).toEqual([]);
    expect(validateTailoredBullets({ bullets: [null, 5, {}] }, RESUME)).toEqual([]);
  });
});

describe("helpers", () => {
  it("finds numbers outside blanks and the blanks themselves", () => {
    expect([...numbersIn("Cut load time by 40% across 1,200 pages [add: 5 users]")].sort()).toEqual(["1200", "40"]);
    expect(placeholdersIn("Did a thing [add result] and another [add tool]")).toEqual(["add result", "add tool"]);
  });
});

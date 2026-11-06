// Turning a posting's description into plain text. Greenhouse sends its
// description as HTML that has itself been HTML-escaped ("&lt;p&gt;..."), so it
// is decoded first, then stripped; Lever and Ashby already provide plain text.

const MAX_DESCRIPTION = 12000;

const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const e = entity.toLowerCase();
    if (e.startsWith("#x")) {
      const code = parseInt(e.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    if (e.startsWith("#")) {
      const code = parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(NAMED, e) ? NAMED[e] : match;
  });
}

function tidy(s, max = MAX_DESCRIPTION) {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** HTML (possibly escaped) to readable plain text, capped in length. */
function htmlToText(html, max = MAX_DESCRIPTION) {
  if (typeof html !== "string" || html === "") return "";
  let s = decodeEntities(html);
  s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|li|h[1-6]|ul|ol|tr|section)\s*>/gi, "\n");
  s = s.replace(/<\s*li[^>]*>/gi, "• ");
  s = s.replace(/<[^>]*>/g, " ");
  s = decodeEntities(s);
  return tidy(s, max);
}

/** Already-plain text: normalise whitespace and cap the length. */
function plainText(text, max = MAX_DESCRIPTION) {
  if (typeof text !== "string" || text === "") return "";
  return tidy(text, max);
}

module.exports = { htmlToText, plainText, decodeEntities, MAX_DESCRIPTION };

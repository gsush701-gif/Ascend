// Packs the built extension (dist/) into a zip for people to download from the
// website and for uploading to the Chrome Web Store. Run via `npm run package`,
// which builds first. The manifest sits at the root of the zip, which is what
// both "Load unpacked" (after unzipping) and the Web Store expect.
//
// File dates are fixed so building twice from the same source gives the same
// zip, and the committed copy only changes when the extension really does.

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const DIST = path.join(__dirname, "dist");
const OUT = path.join(__dirname, "..", "public", "ascend-extension.zip");
const FIXED_DATE = new Date("2026-01-01T00:00:00Z");

function addDir(zip, dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const name = prefix + entry.name;
    if (entry.isDirectory()) addDir(zip, full, `${name}/`);
    // createFolders: false stops JSZip adding dated directory entries of its own.
    else zip.file(name, fs.readFileSync(full), { date: FIXED_DATE, createFolders: false });
  }
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "manifest.json"))) {
    throw new Error("dist/manifest.json not found. Run `npm run build` first (or use `npm run package`).");
  }
  const zip = new JSZip();
  addDir(zip, DIST);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buffer);
  const version = JSON.parse(fs.readFileSync(path.join(DIST, "manifest.json"), "utf8")).version;
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} (version ${version}, ${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

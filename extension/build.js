// Minimal esbuild build script for the Ascend extension.
// Bundles the background service worker, content scripts, and popup script
// (each needs its own bundle since @supabase/supabase-js can't be loaded
// from a CDN under Manifest V3's CSP — everything must be bundled locally).
//
// Usage:
//   npm run build        one-off build into dist/
//   npm run watch         rebuild on change (for iterating with "Load unpacked")

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const PUBLIC = path.join(__dirname, "public");
const ICONS = path.join(__dirname, "icons");
const DIST = path.join(__dirname, "dist");

const entryPoints = {
  background: path.join(SRC, "background.js"),
  "content-linkedin": path.join(SRC, "content-linkedin.js"),
  "content-indeed": path.join(SRC, "content-indeed.js"),
  popup: path.join(SRC, "popup.js"),
};

function copyStaticFiles() {
  fs.mkdirSync(DIST, { recursive: true });
  fs.mkdirSync(path.join(DIST, "icons"), { recursive: true });

  fs.copyFileSync(
    path.join(__dirname, "manifest.json"),
    path.join(DIST, "manifest.json"),
  );

  for (const file of fs.readdirSync(PUBLIC)) {
    fs.copyFileSync(path.join(PUBLIC, file), path.join(DIST, file));
  }

  for (const file of fs.readdirSync(ICONS)) {
    if (!file.endsWith(".png")) continue;
    fs.copyFileSync(path.join(ICONS, file), path.join(DIST, "icons", file));
  }
}

async function main() {
  const watch = process.argv.includes("--watch");

  copyStaticFiles();

  const ctx = await esbuild.context({
    entryPoints,
    outdir: DIST,
    bundle: true,
    format: "iife",
    target: ["chrome110"],
    logLevel: "info",
    sourcemap: watch ? "inline" : false,
    minify: !watch,
  });

  if (watch) {
    await ctx.watch();
    console.log("[ascend-extension] watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log(`[ascend-extension] build complete -> ${DIST}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Copies the Stockfish WASM engine files from node_modules into public/ so they
// are served as static assets (Vercel serves .wasm as application/wasm).
// Runs automatically before `dev` and `build`. Output is gitignored.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = require.resolve("stockfish/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const binDir = join(dirname(pkgPath), "bin");

// Keep in sync with src/core/engine/assets.ts
const FLAVORS = ["lite", "lite-single"];
const outRoot = join(root, "public", "stockfish");
const outDir = join(outRoot, pkg.version);

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const flavor of FLAVORS) {
  for (const ext of ["js", "wasm"]) {
    const file = `stockfish-${pkg.buildVersion}-${flavor}.${ext}`;
    const src = join(binDir, file);
    if (!existsSync(src)) {
      console.error(`[copy-engine] Missing ${src}. Is the stockfish package installed?`);
      process.exit(1);
    }
    cpSync(src, join(outDir, file));
  }
}
cpSync(join(dirname(pkgPath), "Copying.txt"), join(outDir, "COPYING.txt"));

// The app hardcodes the engine path (src/core/engine/assets.ts); fail loudly on drift.
const assetsTs = readFileSync(join(root, "src", "core", "engine", "assets.ts"), "utf8");
if (
  !assetsTs.includes(`STOCKFISH_VERSION = "${pkg.version}"`) ||
  !assetsTs.includes(`STOCKFISH_BUILD = "${pkg.buildVersion}"`)
) {
  console.error(
    `[copy-engine] src/core/engine/assets.ts does not match stockfish ${pkg.version} (build ${pkg.buildVersion}). Update it.`,
  );
  process.exit(1);
}
console.log(
  `[copy-engine] Stockfish ${pkg.version} (${FLAVORS.join(", ")}) -> public/stockfish/${pkg.version}`,
);

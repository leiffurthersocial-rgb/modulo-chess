// Builds src/modules/openings/data/openings.json from the lichess-org/chess-openings
// TSV files (CC0) in data/openings. Each entry is keyed by EPD (FEN without clocks).
// Run with: npm run build:openings  (output is committed).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = {};
let count = 0;
for (const vol of ["a", "b", "c", "d", "e"]) {
  const lines = readFileSync(join(root, "data", "openings", `${vol}.tsv`), "utf8")
    .trim()
    .split("\n");
  for (const line of lines.slice(1)) {
    const [eco, name, pgn] = line.split("\t");
    const chess = new Chess();
    const sans = pgn
      .replace(/\d+\.(\.\.)?/g, " ")
      .trim()
      .split(/\s+/);
    for (const san of sans) chess.move(san);
    const epd = chess.fen().split(" ").slice(0, 4).join(" ");
    // Later (more specific) entries for the same position win, matching lichess behaviour.
    out[epd] = [eco, name, sans.length];
    count++;
  }
}
const dir = join(root, "src", "modules", "openings", "data");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "openings.json"), JSON.stringify(out));
console.log(`[build-openings] ${count} lines -> ${Object.keys(out).length} positions`);

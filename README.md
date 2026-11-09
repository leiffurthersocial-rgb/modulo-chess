# Modulo: Chess

**A modular chess analysis and play platform. Stockfish 19 runs entirely in your browser: no account, no backend, and nothing leaves your device.**

Every feature is an isolated _module_ that plugs into a small core: the board, the engine, game review, import/export, openings and settings. New features can be added without refactoring anything, which is where the name comes from. The logo is a modulo operator (`%`) whose dots are chess squares.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fleiffurthersocial-rgb%2Fmodulo-chess&project-name=modulo-chess&repository-name=modulo-chess)

| Game review (dark)                               | Openings (light, Walnut + Merida)                         |
| ------------------------------------------------ | --------------------------------------------------------- |
| ![Game review](docs/screenshots/review-dark.jpg) | ![Openings explorer](docs/screenshots/openings-light.jpg) |

| Live engine analysis                              | Mobile                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Engine panel](docs/screenshots/engine-dark.jpg) | <img src="docs/screenshots/mobile-dark.jpg" alt="Mobile layout" width="300" /> |

---

## Features

**Board & play**

- Custom animated board: drag-and-drop (mouse and touch), click-to-move, legal-move hints, last-move and check highlights, promotion picker, flip, coordinates.
- Moves animate because piece identity is tracked between positions; a CSS transform does the rest.
- Move list with **variations** (every move from an earlier position creates a branch), comments and NAGs, plus promote/delete variation. Navigate with the arrow keys or by clicking.
- Play against Stockfish at **Skill Level 0–20** or a **target Elo (1320–3190)** via `UCI_LimitStrength`, as White, Black or random, optionally from the current position. Takeback, resign, rematch, and one click to review the game.

**Local Stockfish analysis**

- Stockfish 19 (lite NNUE) compiled to WebAssembly, running in a Web Worker.
- The **multi-threaded** build is used when the page is cross-origin isolated. It **falls back to single-threaded** automatically when `SharedArrayBuffer` is unavailable or the threaded build fails.
- Live eval bar plus numeric evaluation (centipawns / mate-in-N, from White's point of view), win %, depth / seldepth, nodes/sec and node count.
- **MultiPV 1–5** with principal variations in SAN. Hover or click a move to preview it on the board, double-click to play the line up to that move, and ▶ to play the first move. Best-move arrows are drawn for each line.
- Start/stop toggle (`E`), plus threads, hash, depth limit and MultiPV, all persisted in `localStorage`.

**Game review**

- Evaluates every main-line position at a chosen depth (each capped at 3 s). Moves are classified **book / best / excellent / good / inaccuracy / mistake / blunder** by win-probability loss (chess.com's expected-points bands).
- Per-side accuracy (lichess formula), an interactive eval graph with mistake markers, key moments, and "best was …" for each move.

**Import / export**

- Paste PGN or FEN (auto-detected), open a `.pgn` file, or drag-and-drop one. Multi-game files open a picker.
- Copy the FEN, and copy or download the PGN with variations, comments and NAGs preserved (the PGN parser and serializer handle nested RAVs).

**Openings**

- Names the current opening (ECO code + name) from 3,800+ bundled lines (CC0), with book continuations from the current position. It is built on an `OpeningExplorerProvider` interface so a database-backed explorer can be added later.

**Design**

- Dark theme by default plus light and system themes, all as CSS variables. There are 5 board themes and 4 open-licensed piece sets.
- Typography: Geist, Geist Mono for numbers and moves, and Instrument Serif for display text. Motion is subtle and respects `prefers-reduced-motion`.
- Responsive. On desktop: nav rail, centred board, tabbed analysis panel and move list. On mobile: full-width board, a move strip, and a draggable bottom sheet.
- Accessible: the board is an ARIA grid with a roving keyboard cursor (arrows + Enter to move pieces). Visible focus states, live regions for engine and game status, a skip link, and a `?` shortcut sheet.
- Synthesized move, capture, check and game-end sounds (WebAudio, no audio assets), which can be toggled off.

## Quick start

Requires Node.js ≥ 20.9.

```bash
npm install        # also copies the Stockfish WASM files into public/stockfish/
npm run dev        # http://localhost:3000
```

| Script                            | What it does                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server                                                  |
| `npm run lint`                    | ESLint (Next.js core-web-vitals + TypeScript + Prettier compat)                                            |
| `npm run format` / `format:check` | Prettier                                                                                                   |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit` (strict)                                                                   |
| `npm test`                        | Vitest unit tests (UCI parsing, eval normalization, classification, PGN, EngineService races, board logic) |
| `npm run verify:engine`           | End-to-end browser check of the engine (see below)                                                         |
| `npm run build:openings`          | Rebuilds `src/modules/openings/data/openings.json` from `data/openings/*.tsv`                              |

### End-to-end engine verification

```bash
npm run build && npm start
```

```bash
npm i -D playwright && npx playwright install chromium   # once
npm run verify:engine -- http://localhost:3000
```

This drives a real Chromium through 15 checks:

- cross-origin isolation and the multi-threaded boot
- 3 MultiPV lines that deepen with nodes/sec
- correct lines after rapid position changes
- a clean stop
- PGN import with variations, then a full-game review
- drag-and-drop and keyboard-only moves
- a reply from the engine opponent
- the single-threaded fallback when COOP/COEP are stripped
- mobile overflow and page errors

## Architecture

```
src/
├── app/                      Next.js App Router: root layout (hosts the shell), [[...slug]] routes
├── core/                     Framework-free logic (unit tested)
│   ├── engine/               EngineService (UCI client), transport, parser, eval math, worker boot, pool
│   ├── chess/                Game tree with variations, PGN parser/serializer, FEN helpers
│   ├── analysis/             Move classification + accuracy
│   ├── modules/              ModuleManifest type + registry
│   ├── models/               Domain models & repository interfaces for roadmap features
│   └── sound/                WebAudio sound kit
├── modules/                  ← features live here
│   ├── registry.ts           the only list of installed modules
│   ├── board/                Play panel, engine opponent controller, sounds + hotkeys
│   ├── engine/               Engine panel + live-analysis controller
│   ├── game-review/          Review panel, eval graph, review runner
│   ├── import-export/        PGN/FEN import & export
│   ├── openings/             ECO lookup, explorer provider interface, bundled data
│   └── settings/             Settings panel + theme controller
├── stores/                   Zustand stores (game, engine, review, settings, openings, toasts)
├── components/               board/, shell/ (AppShell, BoardArea, MoveList), ui/ primitives
└── themes/                   Board themes and piece-set metadata
```

```mermaid
flowchart LR
  subgraph Shell["App shell (root layout)"]
    Nav[Nav rail / tabs] --- Board[BoardArea + MoveList] --- Panel[Active module panel]
  end
  Registry[(modules/registry.ts)] -->|manifests| Shell
  Registry --> Controllers[Module controllers<br/>engine · play · sounds · theme]
  Controllers --> Stores[(Zustand stores<br/>game · engine · review · settings)]
  Shell <--> Stores
  Controllers --> Pool[Engine pool<br/>analysis · play]
  Pool --> ES[EngineService<br/>UCI job queue]
  ES <-->|postMessage| Worker[[Web Worker<br/>Stockfish 19 WASM]]
```

### The module system

A module is a folder in `src/modules/<id>/` whose `index.ts` exports a `ModuleManifest` (see `src/core/modules/types.ts`):

```ts
export interface ModuleManifest {
  id: string; // kebab-case, unique
  name: string; // nav / tab label
  description: string; // page metadata + header
  icon: ComponentType; // lucide-react icon
  route?: string; // e.g. "/review"; "/" = default module
  order: number; // nav order
  panel?: ComponentType; // shown in the analysis panel / mobile sheet
  controller?: ComponentType; // headless, mounted once for the app's lifetime
  shortcut?: string; // single key that opens the panel
  hidden?: boolean;
}
```

The registry (`createRegistry`) validates ids and routes so mistakes fail the build. The shell derives everything else from the manifests: the sidebar, panel tabs, mobile sheet tabs, keyboard shortcuts, background controllers and the statically generated routes, via `generateStaticParams` in `app/[[...slug]]/page.tsx`. The workspace lives in the root layout, so the board, engine and review state survive navigation between modules.

### Adding a module

1. Create `src/modules/puzzles/PuzzlesPanel.tsx` (a `"use client"` component). Read and write shared state through the stores: `useGame` for the board/tree, `useEngine`, `useSettings`, and so on.
2. Create `src/modules/puzzles/index.ts`:
   ```ts
   import { Puzzle } from "lucide-react";
   import type { ModuleManifest } from "@/core/modules/types";
   import { PuzzlesPanel } from "./PuzzlesPanel";

   export const puzzlesModule: ModuleManifest = {
     id: "puzzles",
     name: "Puzzles",
     description: "Tactics training.",
     icon: Puzzle,
     route: "/puzzles",
     order: 60,
     panel: PuzzlesPanel,
     shortcut: "z",
   };
   ```
3. Add `puzzlesModule` to the array in `src/modules/registry.ts`.

That's all. `/puzzles` is generated at build time, and the module appears in navigation and in the mobile sheet. If the module needs background work, such as a clock or a websocket, give it a `controller`. If it needs the engine, call `getEngine("analysis" | "play")` from `src/core/engine/pool.ts`, or add a new role.

## How Stockfish is integrated

- **Package.** [`stockfish@19.0.1`](https://www.npmjs.com/package/stockfish) (Nathan Rugg's stockfish.js) compiles the [official Stockfish](https://github.com/official-stockfish/Stockfish) to WASM. It ships five builds. Modulo uses the two **lite** builds, about 1.7 MB each: `stockfish-19-lite.js` (multi-threaded) and `stockfish-19-lite-single.js`. The full-network builds are about 99 MB each, which is impractical to download on a website.
- **Serving.** `scripts/copy-engine.mjs` runs on `postinstall`, `predev` and `prebuild`. It copies the builds and their licence from `node_modules` to `public/stockfish/<version>/`, and checks that `src/core/engine/assets.ts` matches the installed version. The versioned path is served with `Cache-Control: immutable`. Each `.js` file loads its sibling `.wasm` and starts its own thread workers from its own URL, so the bundler never touches it.
- **Worker boot** (`core/engine/browser.ts`). If `crossOriginIsolated && SharedArrayBuffer` holds, it boots the multi-threaded build; if that throws or times out, it falls back to the single-threaded build. The UI shows the reason for any fallback. You can also force a build in Settings.
- **`EngineService`** (`core/engine/EngineService.ts`) is a typed, promise-based UCI client over an `EngineTransport`, so tests can use a fake engine:
  - `init()` handles the `uci`/`uciok` and `isready`/`readyok` handshake and collects options.
  - `setOptions()` sends only changed options, clamped to the engine's min/max, then syncs.
  - `newGame()` sends `ucinewgame` and syncs.
  - `search(request, { onUpdate, supersede })` returns a handle with a `result` promise and `cancel()`.
  - **Race-freedom invariant:** jobs run strictly one at a time, and a new `go` is never sent until the previous search's `bestmove` has arrived. Every `info` line can therefore be attributed to exactly one search. A superseding search drops queued searches and sends `stop` to the running one. Late `info` lines from cancelled searches are ignored. Unit tests fire 25 overlapping requests at an async fake engine and assert that no lines leak between searches and that `go` never overlaps.
- **Normalization.** UCI scores are relative to the side to move; they are converted to White's point of view (`mate 0` means the side to move is mated). Win % uses the lichess/Stockfish logistic curve (`k = 0.00368208`, cp clamped to ±1000).
- **Roles.** Live analysis and game review share the `analysis` engine (user threads/hash); review pauses live analysis. The play-mode opponent has its own `play` engine (1 thread, 16 MB, strength-limited), so playing never disturbs analysis settings.

## Deployment

### Headers (COOP/COEP)

Multi-threaded WASM needs `SharedArrayBuffer`, which requires cross-origin isolation. `next.config.ts` sends these headers on every route, including static files in `public/`:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Everything the app loads is same-origin: `next/font` self-hosts the fonts and the pieces live in `/public`, so `require-corp` blocks nothing. If you add third-party embeds, scripts or images, they must send `Cross-Origin-Resource-Policy: cross-origin`; otherwise the app still works but drops to the single-threaded engine. On Vercel the `next.config.ts` headers apply to static assets too, so `vercel.json` deliberately does **not** repeat them (duplicated values would make COEP invalid). Vercel serves `.wasm` as `application/wasm` out of the box.

### GitHub

```bash
gh repo create modulo-chess --public --source=. --remote=origin --push
```

The repository already lives at `leiffurthersocial-rgb/modulo-chess`. GitHub Actions (`.github/workflows/ci.yml`) runs install, lint, format check, typecheck, tests and build on every pull request and on pushes to `main`.

### Vercel

**Option A: dashboard.** Click **Deploy with Vercel** above, or go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo. The framework (Next.js), install (`npm ci`) and build (`npm run build`) commands come from `vercel.json`. No environment variables are needed. Every push to `main` deploys to production and every PR gets a preview URL.

**Option B: CLI.**

```bash
npm i -g vercel
```

```bash
vercel link          # create or link the project
```

```bash
vercel git connect   # deploy automatically on push
```

```bash
vercel --prod        # first production deploy
```

After deploying, open the site and run `crossOriginIsolated` in the console; it should print `true`. The Engine panel should show `· multi-threaded`.

## Licensing

- **Modulo: Chess source code: MIT** (see `LICENSE`).
- **Stockfish: GPL-3.0.** The engine is not vendored in this repo. It is installed from npm (`stockfish`, GPL-3.0) and served unmodified as separate files at `/stockfish/<version>/`, together with its licence (`COPYING.txt`). The app talks to it only through the UCI text protocol over `postMessage`, the same arms-length arrangement GUIs like lichess and chess.com use. What this means for you:
  - If you deploy Modulo, you are distributing Stockfish binaries. You must make the corresponding source available; linking to [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish) and [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) at the matching version does that, and the Settings → About panel already links both. You must also keep the licence file served.
  - If you **modify or rebuild** the engine, you must publish your modified engine source under GPL-3.0.
  - Bundling Stockfish **into** the app's own JavaScript, rather than running it as a separate worker program, could make the combined work subject to GPL-3.0. Keep it separate if you want the rest of the code MIT.
  - _This is a practical summary, not legal advice._
- **Piece sets:** Cburnett and Merida (GPLv2+), Chessnut (Apache-2.0), Spatial (MIT). All are redistributed unmodified from lichess-org/lila with credits in `public/pieces/CREDITS.md` and in the app's About section.
- **Opening data:** [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0.
- **Fonts:** Geist and Geist Mono (SIL OFL), Instrument Serif (SIL OFL), self-hosted via `next/font`.

## Roadmap

The design is ready for these; none of them are built yet. Domain models and repository interfaces live in `src/core/models` (`SavedGame`, `GameRepository`, `PositionAnalysis`, `AnalysisRepository`, `TrainingItem`, `SharedAnalysis`, `UserProfile`).

- **Accounts & saved games:** an `accounts` module plus a `GameRepository` implementation (IndexedDB first, then an API). PGN is the canonical storage format.
- **Shareable analysis links:** encode `SharedAnalysis` (PGN + ply + orientation) in the URL and hydrate `useGame` on load.
- **Online play:** a `play-online` module with a websocket `controller`; the board already supports per-colour movability.
- **Puzzles & opening trainer:** modules driven by `TrainingItem`. The openings module's provider interface feeds the trainer.
- **Game database & real opening explorer:** new `OpeningExplorerProvider`s (masters, Lichess, personal games) with move statistics.
- **Cloud analysis:** an `AnalysisRepository` backed by a server engine, keyed by EPD so local and cloud results merge.

## Known limitations

- Games live in memory; a full page reload starts a fresh board. Settings persist. Saved games are on the roadmap.
- The lite NNUE is weaker than full Stockfish (still far beyond human strength). Depth/nps are lower in single-threaded mode, for example on hosts without COOP/COEP or in browsers that refuse `SharedArrayBuffer`.
- Elo-limited play uses Stockfish's own `UCI_Elo` calibration (engine-vs-engine, long time controls), so it can feel stronger than human ratings suggest at the low end.
- Accuracy uses a plain mean of per-move accuracy (lichess uses a volatility-weighted blend), so numbers differ slightly from lichess and chess.com.
- On short phone screens the bottom sheet's half and full states cover the board controls; swipe the sheet down to reach them.
- Under Partial Prerendering, unknown URLs show the in-app "Off the board" message but return HTTP 200.

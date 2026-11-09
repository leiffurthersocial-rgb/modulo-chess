import { combineEstimates, roundElo } from "@/core/analysis/eloEstimate";
import { MAX_ELO, MIN_ELO } from "@/core/engine/strength";
import { playSound } from "@/core/sound/sounds";
import { useElo, type EloMode } from "@/stores/elo";
import { useGame } from "@/stores/game";
import { useSettings } from "@/stores/settings";

export const GAMES_PER_MODE: Record<EloMode, number> = { quick: 1, full: 3 };

function beginGame(opponentElo: number) {
  const { games, mode, totalGames } = useElo.getState();
  // Alternate colours: White, Black, White…
  const userColor = games.length % 2 === 0 ? "w" : "b";
  const label =
    mode === "quick" ? "Quick Elo estimate" : `Elo estimate · game ${games.length + 1} of ${totalGames}`;
  useGame.getState().startPlay({ userColor, strength: { elo: opponentElo } }, { event: label });
  useElo.getState().patch({
    status: "playing",
    opponentElo,
    opponentSamples: [],
    gameKey: useGame.getState().gameKey,
    evals: {},
    moveScores: {},
  });
  const { sound, volume } = useSettings.getState();
  if (sound) playSound("start", volume);
}

export function startEloSession(mode: EloMode, startElo: number) {
  useElo.getState().patch({
    mode,
    totalGames: GAMES_PER_MODE[mode],
    games: [],
    startElo,
    final: null,
  });
  beginGame(startElo);
}

/** Opponent for the next game: the estimate so far. */
export function nextOpponentElo(): number {
  const { games, startElo } = useElo.getState();
  const est = combineEstimates(games);
  return roundElo(Math.max(MIN_ELO, Math.min(MAX_ELO, est?.elo ?? startElo)));
}

export function startNextGame() {
  beginGame(nextOpponentElo());
}

export function resignEloGame() {
  const { play, setResult } = useGame.getState();
  setResult(play.userColor === "w" ? "0-1" : "1-0");
}

export function abandonSession() {
  useElo.getState().patch({ status: "idle", mode: null, gameKey: null, games: [], final: null });
  if (useGame.getState().mode === "play") useGame.getState().stopPlay();
}

export function resetToIntro() {
  useElo.getState().patch({ status: "idle", mode: null, gameKey: null, games: [], final: null });
}

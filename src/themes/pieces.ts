export interface PieceSet {
  id: string;
  name: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

/** All sets are redistributed from lichess-org/lila (see public/pieces/CREDITS.md). */
export const PIECE_SETS: PieceSet[] = [
  {
    id: "cburnett",
    name: "Cburnett",
    author: "Colin M.L. Burnett",
    license: "GPLv2+",
    licenseUrl: "https://www.gnu.org/licenses/gpl-2.0.txt",
    source: "https://en.wikipedia.org/wiki/User:Cburnett",
  },
  {
    id: "merida",
    name: "Merida",
    author: "Armando Hernandez Marroquin",
    license: "GPLv2+",
    licenseUrl: "https://www.gnu.org/licenses/gpl-2.0.txt",
    source: "https://github.com/lichess-org/lila/tree/master/public/piece/merida",
  },
  {
    id: "chessnut",
    name: "Chessnut",
    author: "Alexis Luengas",
    license: "Apache-2.0",
    licenseUrl: "https://github.com/LexLuengas/chessnut-pieces/blob/master/LICENSE.txt",
    source: "https://github.com/LexLuengas/chessnut-pieces",
  },
  {
    id: "spatial",
    name: "Spatial",
    author: "Maurizio Monge",
    license: "MIT",
    licenseUrl: "https://github.com/maurimo/chess-art/blob/main/LICENSE",
    source: "https://github.com/maurimo/chess-art",
  },
];

export const DEFAULT_PIECE_SET = "cburnett";

export function pieceSet(id: string): PieceSet {
  return PIECE_SETS.find((p) => p.id === id) ?? PIECE_SETS[0];
}

export function pieceUrl(set: string, color: "w" | "b", type: string): string {
  return `/pieces/${pieceSet(set).id}/${color}${type.toUpperCase()}.svg`;
}

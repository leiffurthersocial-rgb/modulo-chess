export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** Coordinate label colours on light/dark squares. */
  coordLight: string;
  coordDark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "wood",
    name: "Wood",
    light: "#f0d9b5",
    dark: "#b58863",
    coordLight: "#b58863",
    coordDark: "#f0d9b5",
  },
  {
    id: "green",
    name: "Green",
    light: "#eeeed2",
    dark: "#769656",
    coordLight: "#769656",
    coordDark: "#eeeed2",
  },
  {
    id: "graphite",
    name: "Graphite",
    light: "#c9ced6",
    dark: "#737c8c",
    coordLight: "#5b6474",
    coordDark: "#dfe3ea",
  },
  {
    id: "glacier",
    name: "Glacier",
    light: "#dde7ef",
    dark: "#7f9db8",
    coordLight: "#5f7f9b",
    coordDark: "#eaf1f7",
  },
  {
    id: "rosewood",
    name: "Rosewood",
    light: "#efd9d2",
    dark: "#a8706a",
    coordLight: "#8e5751",
    coordDark: "#f7e8e3",
  },
];

export const DEFAULT_BOARD_THEME = "wood";

export function boardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

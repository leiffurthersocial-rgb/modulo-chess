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
    id: "graphite",
    name: "Graphite",
    light: "#c9ced6",
    dark: "#737c8c",
    coordLight: "#5b6474",
    coordDark: "#dfe3ea",
  },
  {
    id: "walnut",
    name: "Walnut",
    light: "#ead3b0",
    dark: "#ad7f57",
    coordLight: "#8f6643",
    coordDark: "#f4e4cb",
  },
  {
    id: "sage",
    name: "Sage",
    light: "#e6e9cf",
    dark: "#7e9764",
    coordLight: "#667d4e",
    coordDark: "#eef1dc",
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

export const DEFAULT_BOARD_THEME = "graphite";

export function boardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

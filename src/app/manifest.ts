import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Modulo: Chess",
    short_name: "Modulo",
    description: "Chess analysis and play with Stockfish running in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#101216",
    theme_color: "#17191e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

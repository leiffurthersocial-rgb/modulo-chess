import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans, Nunito } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { SETTINGS_STORAGE_KEY } from "@/stores/settings";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});
const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Modulo: Chess", template: "%s · Modulo: Chess" },
  description:
    "A modular chess analysis and play platform. Stockfish 19 runs entirely in your browser — no account, no uploads.",
  applicationName: "Modulo: Chess",
  keywords: ["chess", "stockfish", "analysis", "pgn", "game review", "wasm"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17191e" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

/** Applies the persisted theme before first paint to avoid a flash. */
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY,
)})||"{}").state||{};var t=s.theme||"dark";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.dataset.animations=s.animations===false?"off":"on";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${nunito.variable} ${notoSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

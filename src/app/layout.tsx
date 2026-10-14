import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted OFL faces (public/fonts), so every surface renders the same glyphs with no
// third-party font request: Abril Fatface for the masthead, Atkinson Hyperlegible Next for
// every sentence a family reads, Atkinson Hyperlegible Mono for numbers, URLs and receipts.
const abril = localFont({
  src: "../../public/fonts/abril-fatface-400.woff2",
  weight: "400",
  variable: "--font-abril",
  display: "swap",
  // "Bodoni 72" must stay quoted (a digit token): it lives in the CSS stack, not here.
  fallback: ["Didot", "Georgia", "serif"],
});

const atkinson = localFont({
  src: "../../public/fonts/atkinson-hyperlegible-next-wght.woff2",
  weight: "200 800",
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const atkinsonMono = localFont({
  src: "../../public/fonts/atkinson-hyperlegible-mono-wght.woff2",
  weight: "200 800",
  variable: "--font-atkinson-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

const DESCRIPTION =
  "Paste a job ad. Awas builds an evidence file: every line is a URL plus a quote code found verbatim on that page. Then it says STOP or VERIFY FIRST.";

export const metadata: Metadata = {
  title: "Awas — check a job ad before anyone boards",
  description: DESCRIPTION,
  applicationName: "Awas",
  authors: [{ name: "Edy Cu" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${abril.variable} ${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

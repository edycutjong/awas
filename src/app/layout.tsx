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
  "Paste a job ad: an evidence file where every line is a URL and a quote found verbatim on that page, then STOP, VERIFY FIRST or NO RED FLAGS FOUND.";

const TITLE = "Awas — check a job ad before anyone boards";

// Cards clip descriptions on mobile beyond ~125 characters.
const OG_DESCRIPTION = "Paste a job ad: official rules, quotes checked word for word in code, then STOP, VERIFY FIRST or NO RED FLAGS FOUND.";

export const metadata: Metadata = {
  // The project's production domain (awas.vercel.app belongs to someone else).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://awas-cek.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Awas",
  authors: [{ name: "Edy Cu" }],
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: TITLE,
    description: OG_DESCRIPTION,
    url: "/",
    siteName: "Awas",
    type: "website",
    // Bump ?v= whenever og-image.png changes: platforms cache cards by URL.
    images: [{ url: "/og-image.png?v=6790adc007", width: 1200, height: 630, alt: "Awas — a recorded evidence file: the rule and its official page, a quote found word for word, a STOP stamp" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: OG_DESCRIPTION, images: ["/og-image.png?v=6790adc007"] },
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
